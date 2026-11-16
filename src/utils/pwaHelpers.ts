export type InstallPlatform = 'ios' | 'android' | 'desktop';

export type InstallAttemptResult = 'installed' | 'dismissed' | 'unavailable';

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function isStandaloneDisplay(win: Window | undefined): boolean {
  if (!win) return false;
  return (
    win.matchMedia('(display-mode: standalone)').matches ||
    (win.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function shouldAutoShowPwaPopup(params: { isInstalled: boolean }): boolean {
  return !params.isInstalled;
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
