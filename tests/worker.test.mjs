import assert from "node:assert/strict";
import worker, { validateEvent } from "../analytics-worker/worker.mjs";

assert.deepEqual(validateEvent({
  event: "pageview",
  path: "/install.html",
  source: "facebook"
}), {
  event: "pageview",
  path: "/install.html",
  source: "facebook",
  target: ""
});

assert.deepEqual(validateEvent({
  event: "download",
  path: "/install.html",
  source: "youtube",
  target: "android-beta-download"
}), {
  event: "download",
  path: "/install.html",
  source: "youtube",
  target: "android-beta-download"
});

assert.equal(validateEvent({ event: "pageview", path: "/", source: "unknown-source" }), null);
assert.equal(validateEvent({ event: "download", path: "/", source: "direct" }), null);
assert.equal(validateEvent({ event: "pageview", path: "/?private=value", source: "direct" }), null);
assert.equal(validateEvent({ event: "pageview", path: "/", source: "direct", target: "unexpected" }), null);

const reportEnv = {
  ALLOWED_ORIGINS: "https://outabit.com,https://www.outabit.com",
  REPORT_TOKEN: "local-test-token",
  ANALYTICS_DB: {
    prepare() {
      return {
        bind() {
          return {
            all: async () => ({ results: [] })
          };
        }
      };
    }
  }
};

const unauthorized = await worker.fetch(new Request("https://analytics.example/report"), reportEnv);
assert.equal(unauthorized.status, 401);
assert.equal(unauthorized.headers.get("cache-control"), "no-store");

const credentials = Buffer.from("owner:local-test-token", "utf8").toString("base64");
const authorized = await worker.fetch(new Request("https://analytics.example/report", {
  headers: { Authorization: `Basic ${credentials}` }
}), reportEnv);
assert.equal(authorized.status, 200);
assert.equal(authorized.headers.get("cache-control"), "no-store");
assert.equal(authorized.headers.get("x-frame-options"), "DENY");
assert.match(await authorized.text(), /No visitor-level records are stored/);

console.log("analytics worker tests passed");
