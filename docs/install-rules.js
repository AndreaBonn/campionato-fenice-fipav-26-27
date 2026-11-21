// Pure rules of the "keep it on your phone" hint: where the page runs and whether to offer the install. No DOM.

const IOS_DEVICE = /iPhone|iPad|iPod/;
// Browsers on iOS that are not Safari and cannot add to the Home screen from their own menu the same way
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//;

// Safari on an iPhone or iPad. iPadOS reports a Mac user agent: a Mac with a touch screen is an iPad
export function isIosSafari({ userAgent, maxTouchPoints }) {
  const ios = IOS_DEVICE.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /Safari/.test(userAgent) && !IOS_OTHER_BROWSER.test(userAgent);
}

// Running as an installed app: the display-mode media query, or the flag iOS Safari sets on its own
export const isStandalone = (displayModeQuery, navigatorStandalone) => Boolean(displayModeQuery?.matches) || navigatorStandalone === true;

// "prompt": the browser can install on request; "ios": explain the Share menu; null: show nothing
export function hintMode({ standalone, dismissed, installed, iosSafari, canPrompt }) {
  if (standalone || dismissed || installed) return null;
  if (canPrompt) return "prompt";
  return iosSafari ? "ios" : null;
}
