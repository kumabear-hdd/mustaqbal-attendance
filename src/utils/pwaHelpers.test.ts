import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectInstallPlatform,
  getManualInstallHint,
  isEmbeddedIframe,
  shouldAutoShowPwaPopup,
} from './pwaHelpers';

test('detectInstallPlatform identifies iOS, Android, and desktop user agents', () => {
  assert.equal(
    detectInstallPlatform(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    ),
    'ios'
  );
  assert.equal(
    detectInstallPlatform(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile'
    ),
    'android'
  );
  assert.equal(
    detectInstallPlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0'
    ),
    'desktop'
  );
});

test('shouldAutoShowPwaPopup shows on every entry/login unless already installed', () => {
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: false }), true);
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: true }), false);
});

test('isEmbeddedIframe and getManualInstallHint handle iframe and platform cases', () => {
  const sameObj = {};
  assert.equal(isEmbeddedIframe({ self: sameObj, top: sameObj }), false);
  assert.equal(isEmbeddedIframe({ self: {}, top: {} }), true);

  assert.match(
    getManualInstallHint({ platform: 'desktop', inIframe: true }),
    /jendela preview/i
  );
  assert.match(
    getManualInstallHint({ platform: 'ios', inIframe: false }),
    /Bagikan/i
  );
  assert.match(
    getManualInstallHint({ platform: 'android', inIframe: false }),
    /Chrome Android/i
  );
});
