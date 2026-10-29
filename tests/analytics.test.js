const assert = require("node:assert/strict");
const analytics = require("../analytics.js");

assert.equal(analytics.sourceFromUtm("facebook"), "facebook");
assert.equal(analytics.sourceFromUtm("FB"), "facebook");
assert.equal(analytics.sourceFromUtm("linkedin"), "linkedin");
assert.equal(analytics.sourceFromUtm("untrusted-campaign-name"), "other");
assert.equal(analytics.sourceFromUtm(""), null);

assert.equal(analytics.sourceFromReferrer("", "outabit.com"), "direct");
assert.equal(analytics.sourceFromReferrer("https://www.facebook.com/posts/1", "outabit.com"), "facebook");
assert.equal(analytics.sourceFromReferrer("https://m.youtube.com/watch?v=1", "outabit.com"), "youtube");
assert.equal(analytics.sourceFromReferrer("https://outabit.com/install.html", "outabit.com"), "internal");
assert.equal(analytics.sourceFromReferrer("https://example.org/page?private=value", "outabit.com"), "other");

assert.equal(analytics.safePath("/install.html"), "/install.html");
assert.equal(analytics.safePath("not-a-path"), "/");
assert.equal(analytics.cleanTarget("android-beta-download"), "android-beta-download");
assert.equal(analytics.cleanTarget("unsafe value"), null);

const disabledCalls = [];
const disabled = analytics.start({
  OUTABIT_ANALYTICS_ENDPOINT: "",
  fetch: (...args) => disabledCalls.push(args)
}, {});
assert.equal(disabled, false);
assert.equal(disabledCalls.length, 0);

const sent = [];
const sessionValues = new Map();
const fakeDocument = {
  referrer: "https://www.facebook.com/posts/123?private=value",
  addEventListener() {}
};
const enabled = analytics.start({
  OUTABIT_ANALYTICS_ENDPOINT: "https://analytics.example/collect",
  location: {
    href: "https://outabit.com/install.html?utm_campaign=private-value",
    hostname: "outabit.com",
    pathname: "/install.html"
  },
  sessionStorage: {
    getItem: (key) => sessionValues.get(key) || null,
    setItem: (key, value) => sessionValues.set(key, value)
  },
  fetch: (url, options) => {
    sent.push({ url, options });
    return Promise.resolve();
  }
}, fakeDocument);
assert.equal(enabled, true);
assert.equal(sent.length, 2);
assert.equal(sent[0].url, "https://analytics.example/collect");
assert.deepEqual(JSON.parse(sent[0].options.body), {
  event: "visit",
  path: "/install.html",
  source: "facebook"
});
assert.deepEqual(JSON.parse(sent[1].options.body), {
  event: "pageview",
  path: "/install.html",
  source: "facebook"
});
assert.equal(sent[0].options.credentials, "omit");
assert.equal(sent[0].options.referrerPolicy, "no-referrer");

analytics.start({
  OUTABIT_ANALYTICS_ENDPOINT: "https://analytics.example/collect",
  location: {
    href: "https://outabit.com/install.html",
    hostname: "outabit.com",
    pathname: "/install.html"
  },
  sessionStorage: {
    getItem: (key) => sessionValues.get(key) || null,
    setItem: (key, value) => sessionValues.set(key, value)
  },
  fetch: (url, options) => {
    sent.push({ url, options });
    return Promise.resolve();
  }
}, fakeDocument);
assert.equal(sent.length, 3);
assert.equal(JSON.parse(sent[2].options.body).event, "pageview");

console.log("analytics client tests passed");
