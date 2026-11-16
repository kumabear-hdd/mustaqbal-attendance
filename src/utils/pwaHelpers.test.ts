import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectInstallPlatform,
  getManualInstallHint,
  isEmbeddedIframe,
  PWA_DISMISS_STORAGE_KEY,
  readPwaDismissed,
  savePwaDismissed,
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

test('shouldAutoShowPwaPopup shows only when not installed and not dismissed', () => {
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: false, isDismissed: false }), true);
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: false, isDismissed: true }), false);
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: true, isDismissed: false }), false);
  assert.equal(shouldAutoShowPwaPopup({ isInstalled: true, isDismissed: true }), false);
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

test('readPwaDismissed and savePwaDismissed persist dismissal cleanly', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  assert.equal(readPwaDismissed(mockStorage), false);
  savePwaDismissed(mockStorage, true);
  assert.equal(store.get(PWA_DISMISS_STORAGE_KEY), '1');
  assert.equal(readPwaDismissed(mockStorage), true);

  savePwaDismissed(mockStorage, false);
  assert.equal(readPwaDismissed(mockStorage), false);
});
