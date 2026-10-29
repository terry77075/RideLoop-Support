import assert from "node:assert/strict";
import { validateEvent } from "../analytics-worker/worker.mjs";

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

console.log("analytics worker tests passed");
