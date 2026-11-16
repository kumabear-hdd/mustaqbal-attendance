export const PWA_DISMISS_STORAGE_KEY = 'sims_pwa_popup_dismissed';

export type InstallPlatform = 'ios' | 'android' | 'desktop';

export type InstallAttemptResult = 'installed' | 'dismissed' | 'unavailable';

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function shouldAutoShowPwaPopup(params: {
  isInstalled: boolean;
  isDismissed: boolean;
}): boolean {
  return !params.isInstalled && !params.isDismissed;
}

export function isEmbeddedIframe(win: { self?: unknown; top?: unknown } | undefined): boolean {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

export function getManualInstallHint(params: {
  platform: InstallPlatform;
  inIframe: boolean;
}): string {
  if (params.inIframe) {
    return 'Instalasi langsung tidak aktif di dalam jendela preview. Buka link aplikasi di tab browser utama (Chrome/Edge/Safari), lalu klik Download Aplikasi.';
  }
  if (params.platform === 'ios') {
    return 'Di Safari iPhone/iPad, ketuk ikon Bagikan (Share) lalu pilih Tambahkan ke Layar Utama.';
  }
  if (params.platform === 'android') {
    return 'Di Chrome Android, ketuk menu titik tiga (⋮) di pojok kanan atas lalu pilih Install aplikasi.';
  }
  return 'Browser belum menampilkan prompt otomatis. Klik ikon Install di ujung kanan address bar Chrome/Edge atau menu (⋮) → Install SIMS Absensi.';
}

export function readPwaDismissed(
  storage: Pick<Storage, 'getItem'> | null | undefined
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PWA_DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function savePwaDismissed(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  dismissed: boolean
): void {
  if (!storage) return;
  try {
    if (dismissed) {
      storage.setItem(PWA_DISMISS_STORAGE_KEY, '1');
    } else {
      storage.removeItem(PWA_DISMISS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}
