const EVENTS = new Set(["visit", "pageview", "download"]);
const SOURCES = new Set([
  "direct",
  "internal",
  "linkedin",
  "facebook",
  "instagram",
  "youtube",
  "google",
  "bing",
  "duckduckgo",
  "email",
  "other"
]);

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "https://outabit.com")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

export function validateEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const event = String(value.event || "");
  const source = String(value.source || "");
  const path = String(value.path || "");
  const target = value.target == null ? "" : String(value.target);

  if (!EVENTS.has(event) || !SOURCES.has(source)) return null;
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]{0,159}$/.test(path)) return null;
  if (target && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(target)) return null;
  if (event === "download" && !target) return null;
  if ((event === "visit" || event === "pageview") && target) return null;

  return { event, source, path, target };
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function reportAuthorized(request, env) {
  const expected = String(env.REPORT_TOKEN || "");
  const header = request.headers.get("Authorization") || "";
  if (!expected || !header.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const supplied = decoded.slice(separator + 1);
    return timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function summarize(rows) {
  const totalVisits = rows
    .filter((row) => row.event === "visit")
    .reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const totalPageviews = rows
    .filter((row) => row.event === "pageview")
    .reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const totalDownloads = rows
    .filter((row) => row.event === "download")
    .reduce((sum, row) => sum + (Number(row.count) || 0), 0);

  function grouped(event, key) {
    const totals = new Map();
    rows.filter((row) => row.event === event).forEach((row) => {
      const label = row[key] || "(none)";
      totals.set(label, (totals.get(label) || 0) + (Number(row.count) || 0));
    });
    return [...totals.entries()].sort((left, right) => right[1] - left[1]);
  }

  return {
    totalVisits,
    totalPageviews,
    totalDownloads,
    sources: grouped("pageview", "source"),
    pages: grouped("pageview", "page_path"),
    downloads: grouped("download", "target"),
    downloadSources: grouped("download", "source")
  };
}

function metricRows(items) {
  if (!items.length) return '<tr><td colspan="2">No data yet</td></tr>';
  return items.map(([label, count]) => `<tr><td>${escapeHtml(label)}</td><td>${count}</td></tr>`).join("");
}

function reportHtml(rows, days) {
  const summary = summarize(rows);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>outabit analytics</title><style>
body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:auto;padding:24px;background:#f5f7f8;color:#172633}h1{margin-bottom:0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:24px 0}.card,section{background:white;border:1px solid #dbe3e8;border-radius:12px;padding:18px}.metric{font-size:2rem;font-weight:750}section{margin:16px 0}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #e5eaed}td:last-child,th:last-child{text-align:right}
</style></head><body><h1>outabit analytics</h1><p>Aggregate counts for the last ${days} days. No visitor-level records are stored.</p>
<div class="cards"><div class="card"><div class="metric">${summary.totalVisits}</div><div>Visits (browser sessions)</div></div><div class="card"><div class="metric">${summary.totalPageviews}</div><div>Page views</div></div><div class="card"><div class="metric">${summary.totalDownloads}</div><div>Download clicks</div></div></div>
<section><h2>Referral sources</h2><table><thead><tr><th>Source</th><th>Views</th></tr></thead><tbody>${metricRows(summary.sources)}</tbody></table></section>
<section><h2>Popular pages</h2><table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>${metricRows(summary.pages)}</tbody></table></section>
<section><h2>Downloads</h2><table><thead><tr><th>Download</th><th>Clicks</th></tr></thead><tbody>${metricRows(summary.downloads)}</tbody></table></section>
<section><h2>Download sources</h2><table><thead><tr><th>Source</th><th>Clicks</th></tr></thead><tbody>${metricRows(summary.downloadSources)}</tbody></table></section>
</body></html>`;
}

async function collect(request, env, origin) {
  if (!origin) return new Response("Forbidden", { status: 403 });

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 2048) return new Response("Payload too large", { status: 413, headers: corsHeaders(origin) });

  let value;
  try {
    const body = await request.text();
    if (body.length > 2048) return new Response("Payload too large", { status: 413, headers: corsHeaders(origin) });
    value = JSON.parse(body);
  } catch {
    return new Response("Invalid event", { status: 400, headers: corsHeaders(origin) });
  }

  const event = validateEvent(value);
  if (!event) return new Response("Invalid event", { status: 400, headers: corsHeaders(origin) });

  const day = new Date().toISOString().slice(0, 10);
  await env.ANALYTICS_DB.prepare(`
    INSERT INTO daily_counts (day, event, page_path, source, target, count)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(day, event, page_path, source, target)
    DO UPDATE SET count = count + 1
  `).bind(day, event.event, event.path, event.source, event.target).run();

  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function report(request, env) {
  if (!reportAuthorized(request, env)) {
    return new Response("Sign in to view aggregate analytics.", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Basic realm="outabit analytics", charset="UTF-8"'
      }
    });
  }

  const url = new URL(request.url);
  const days = Math.min(180, Math.max(1, Number.parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const earliestDay = new Date(Date.now() - ((days - 1) * 86400000)).toISOString().slice(0, 10);
  const { results } = await env.ANALYTICS_DB.prepare(`
    SELECT day, event, page_path, source, target, count
    FROM daily_counts
    WHERE day >= ?
    ORDER BY day DESC
  `).bind(earliestDay).all();

  return new Response(reportHtml(results || [], days), {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (request.method === "OPTIONS" && url.pathname === "/collect") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "POST" && url.pathname === "/collect") {
      return collect(request, env, origin);
    }

    if (request.method === "GET" && url.pathname === "/report") {
      return report(request, env);
    }

    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
};
