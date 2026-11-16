export function mapFirebaseAuthError(
  err: unknown,
  options?: { hostname?: string; projectId?: string }
): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const hostname = options?.hostname || 'domain ini';
  const projectId = options?.projectId || 'Firebase';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah, atau akun belum terdaftar.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Pilih Masuk atau gunakan fitur Lupa password.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Console. Aktifkan di Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return `Domain "${hostname}" belum didaftarkan di Firebase Authentication. Tambahkan "${hostname}" di Firebase Console (${projectId}) → Authentication → Settings → Authorized domains.`;
    case 'auth/popup-closed-by-user':
      return 'Jendela login Google ditutup sebelum selesai.';
    case 'auth/cancelled-popup-request':
      return 'Permintaan login Google dibatalkan karena jendela lain terbuka. Klik Masuk dengan Google sekali lagi.';
    case 'auth/popup-blocked':
      return 'Popup login diblokir browser. Izinkan popup di browser Anda lalu coba lagi.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah terdaftar dengan metode lain (Email/Password). Silakan masuk dengan email & password.';
    case 'auth/web-storage-unsupported':
      return 'Browser memblokir penyimpanan/cookie pihak ketiga yang dibutuhkan login Google. Aktifkan cookie atau gunakan browser Chrome/Safari utama.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.';
    default:
      return code
        ? `Gagal memproses autentikasi (${code}). Silakan coba lagi.`
        : 'Gagal memproses autentikasi. Silakan coba lagi.';
  }
}
