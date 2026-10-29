(function (root, factory) {
  const analytics = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = analytics;
  }

  if (root && root.document) {
    analytics.start(root, root.document);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SOURCE_HOSTS = [
    ["linkedin", ["linkedin.com", "lnkd.in"]],
    ["facebook", ["facebook.com", "fb.com", "fb.me"]],
    ["instagram", ["instagram.com"]],
    ["youtube", ["youtube.com", "youtu.be"]],
    ["google", ["google.com", "googleusercontent.com"]],
    ["bing", ["bing.com"]],
    ["duckduckgo", ["duckduckgo.com"]]
  ];

  const SOURCE_ALIASES = new Map([
    ["linkedin", "linkedin"],
    ["lnkd", "linkedin"],
    ["facebook", "facebook"],
    ["fb", "facebook"],
    ["instagram", "instagram"],
    ["ig", "instagram"],
    ["youtube", "youtube"],
    ["yt", "youtube"],
    ["google", "google"],
    ["bing", "bing"],
    ["duckduckgo", "duckduckgo"],
    ["email", "email"],
    ["newsletter", "email"]
  ]);

  function hostMatches(hostname, candidate) {
    return hostname === candidate || hostname.endsWith(`.${candidate}`);
  }

  function sourceFromUtm(value) {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    return SOURCE_ALIASES.get(normalized) || "other";
  }

  function sourceFromReferrer(referrer, ownHostname) {
    if (!referrer) return "direct";

    try {
      const hostname = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
      const ownHost = String(ownHostname || "").toLowerCase().replace(/^www\./, "");
      if (hostname === ownHost) return "internal";

      const match = SOURCE_HOSTS.find(([, hosts]) => hosts.some((host) => hostMatches(hostname, host)));
      return match ? match[0] : "other";
    } catch {
      return "other";
    }
  }

  function safePath(pathname) {
    const value = String(pathname || "/");
    if (!value.startsWith("/")) return "/";
    return value.slice(0, 160);
  }

  function sessionSource(win, document) {
    const params = new URL(win.location.href).searchParams;
    const taggedSource = sourceFromUtm(params.get("utm_source"));
    const incomingSource = taggedSource || sourceFromReferrer(document.referrer, win.location.hostname);
    const key = "outabit_traffic_source";

    try {
      if (incomingSource === "internal") {
        return win.sessionStorage.getItem(key) || "internal";
      }

      win.sessionStorage.setItem(key, incomingSource);
    } catch {
      // Analytics still works when session storage is unavailable.
    }

    return incomingSource;
  }

  function isNewSession(win) {
    const key = "outabit_session_counted";

    try {
      if (win.sessionStorage.getItem(key)) return false;
      win.sessionStorage.setItem(key, "1");
      return true;
    } catch {
      // Without session storage, count a conservative visit on this page load.
      return true;
    }
  }

  function cleanTarget(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(normalized) ? normalized : null;
  }

  function eventTarget(link) {
    const explicitTarget = cleanTarget(link.getAttribute("data-analytics-event"));
    if (explicitTarget) return explicitTarget;

    try {
      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.pathname.toLowerCase().endsWith(".apk")) return "android-beta-download";
    } catch {
      return null;
    }

    return null;
  }

  function start(win, document) {
    const endpoint = String(win.OUTABIT_ANALYTICS_ENDPOINT || "").trim();
    if (!endpoint) return false;

    try {
      if (new URL(endpoint).protocol !== "https:") return false;
    } catch {
      return false;
    }

    const source = sessionSource(win, document);
    const path = safePath(win.location.pathname);

    function send(event, target) {
      const payload = JSON.stringify({
        event,
        path,
        source,
        ...(target ? { target } : {})
      });

      try {
        void win.fetch(endpoint, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          keepalive: true,
          referrerPolicy: "no-referrer",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: payload
        });
      } catch {
        // Analytics must never interrupt the website experience.
      }
    }

    if (isNewSession(win)) send("visit");
    send("pageview");

    document.addEventListener("click", (event) => {
      const link = event.target.closest && event.target.closest("a[href]");
      if (!link) return;
      const target = eventTarget(link);
      if (target) send("download", target);
    }, { capture: true });

    return true;
  }

  return {
    cleanTarget,
    safePath,
    sourceFromReferrer,
    sourceFromUtm,
    start
  };
});
