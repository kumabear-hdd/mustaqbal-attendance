import assert from 'node:assert/strict';
import test from 'node:test';
import { mapFirebaseAuthError } from './authErrors';

test('mapFirebaseAuthError surfaces actionable guidance for unauthorized-domain on Vercel', () => {
  const msg = mapFirebaseAuthError(
    { code: 'auth/unauthorized-domain' },
    { hostname: 'sims-absensi.vercel.app', projectId: 'semiotic-wind-xthv3' }
  );
  assert.match(msg, /sims-absensi\.vercel\.app/);
  assert.match(msg, /semiotic-wind-xthv3/);
  assert.match(msg, /Authorized domains/i);
});

test('mapFirebaseAuthError handles Google popup & unknown error codes cleanly', () => {
  assert.match(
    mapFirebaseAuthError({ code: 'auth/popup-blocked' }),
    /Popup login diblokir/i
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/cancelled-popup-request' }),
    /dibatalkan/i
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/internal-error' }),
    /auth\/internal-error/
  );
});
