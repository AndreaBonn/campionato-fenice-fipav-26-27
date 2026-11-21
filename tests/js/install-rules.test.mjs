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

test("iOS Safari: navigator.standalone false (a normal tab) is not standalone, true is", () => {
  assert.equal(isStandalone({ matches: false }, false), false);
  assert.equal(isStandalone({ matches: false }, true), true);
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

test("iOS Safari: an iOS web view without the Safari token, and every other iOS browser, are not Safari", () => {
  const webView = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  assert.equal(isIosSafari({ userAgent: webView, maxTouchPoints: 5 }), false);
  for (const token of ["FxiOS/124.0", "EdgiOS/124.0", "OPiOS/48.0", "OPT/4.5"]) {
    const ua = IPHONE_SAFARI.replace("Version/17.4", token);
    assert.equal(isIosSafari({ userAgent: ua, maxTouchPoints: 5 }), false, token);
  }
});

test("hint mode: a browser that can install on request gets the prompt, also on iOS Safari", () => {
  assert.equal(hintMode({ ...base, canPrompt: true, iosSafari: true }), "prompt");
});
