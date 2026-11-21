import assert from "node:assert/strict";
import { test } from "node:test";

import { hintMode, isIosSafari, isStandalone } from "../../docs/install-rules.js";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const MAC_SAFARI = IPAD_AS_MAC;
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

test("iOS Safari: iPhone Safari and iPadOS (desktop UA with touch) yes; iOS Chrome, Android, a Mac no", () => {
  assert.equal(isIosSafari({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 }), false);
  assert.equal(isIosSafari({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }), false);
  assert.equal(isIosSafari({ userAgent: MAC_SAFARI, maxTouchPoints: 0 }), false);
});

test("standalone: the display-mode media query or the iOS navigator.standalone flag", () => {
  assert.equal(isStandalone({ matches: true }, false), true);
  assert.equal(isStandalone({ matches: false }, true), true);
  assert.equal(isStandalone({ matches: false }, undefined), false);
  assert.equal(isStandalone(null, undefined), false);
});

const base = { standalone: false, dismissed: false, installed: false, iosSafari: false, canPrompt: false };

test("hint mode: nothing by default, the prompt once the browser offers the install", () => {
  assert.equal(hintMode(base), null);
  assert.equal(hintMode({ ...base, canPrompt: true }), "prompt");
});

test("hint mode: iOS Safari gets the manual instructions", () => {
  assert.equal(hintMode({ ...base, iosSafari: true }), "ios");
});

test("hint mode: never when running standalone, dismissed or installed, whatever else is true", () => {
  for (const flag of ["standalone", "dismissed", "installed"]) {
    assert.equal(hintMode({ ...base, canPrompt: true, iosSafari: true, [flag]: true }), null, flag);
  }
});
