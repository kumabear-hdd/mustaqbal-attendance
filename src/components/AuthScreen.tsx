import React, { useState } from 'react';
import {
  CheckSquare,
  Cloud,
  Eye,
  EyeOff,
  MailCheck,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import type { ThemeMode } from '../types/sims';

interface AuthScreenProps {
  mode: 'reg' | 'in';
  error: string;
  notice: string;
  theme: ThemeMode;
  pendingVerificationEmail: string | null;
  onToggleMode: () => void;
  onCycleTheme: () => void;
  onSubmit: (email: string, pw: string, pw2: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onCheckVerification: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onCancelVerification: () => Promise<void>;
}

const themeLabels: Record<ThemeMode, string> = {
  auto: 'Tema: Otomatis',
  light: 'Tema: Terang',
  dark: 'Tema: Gelap',
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  mode,
  error,
  notice,
  theme,
  pendingVerificationEmail,
  onToggleMode,
  onCycleTheme,
  onSubmit,
  onGoogleLogin,
  onResetPassword,
  onCheckVerification,
  onResendVerification,
  onCancelVerification,
}) => {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(email, pw, pw2);
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8 bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-[440px] bg-[var(--sf)] border border-[var(--ln)] rounded-2xl p-7 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center shrink-0">
            <CheckSquare className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-tight">
              SIMS Absensi
            </h1>
            <p className="text-xs text-[var(--mu)]">
              Sistem Presensi &amp; Arsip Surat Siswa
            </p>
          </div>
        </div>

        {pendingVerificationEmail ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--sf2)] border border-[var(--ln)] p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <MailCheck className="w-4 h-4 text-[var(--pri)] shrink-0" aria-hidden="true" />
                <span>Verifikasi Email Diperlukan</span>
              </div>
              <p className="text-xs text-[var(--mu)] leading-relaxed">
                Kami telah mengirim tautan verifikasi ke{' '}
                <strong className="text-[var(--ink)]">{pendingVerificationEmail}</strong>.
                Buka kotak masuk atau folder spam email Anda, klik tautan verifikasi,
                lalu tekan tombol di bawah untuk masuk.
              </p>
            </div>

            {notice && (
              <div role="status" className="text-xs font-semibold text-[var(--h)]">
                {notice}
              </div>
            )}
            {error && (
              <div role="alert" className="text-xs font-semibold text-[var(--a)]">
                {error}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void runAction(onCheckVerification)}
                className="w-full min-h-[40px] rounded-lg bg-[var(--pri-btn)] text-white px-4 py-2 text-sm font-semibold hover:brightness-105 transition cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Memeriksa...' : 'Saya sudah verifikasi, masuk sekarang'}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void runAction(onResendVerification)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] text-[var(--ink)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--sf2)] transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kirim ulang email</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void runAction(onCancelVerification)}
                  className="min-h-[38px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] text-[var(--mu)] px-3 py-1.5 text-xs font-semibold hover:text-[var(--ink)] hover:bg-[var(--sf2)] transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  Ganti akun
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--mu)] leading-relaxed mb-3">
              {mode === 'reg'
                ? 'Daftar akun sekolah baru agar data absensi tersimpan di cloud dan dapat diakses dari perangkat mana saja.'
                : 'Masuk dengan akun sekolah Anda untuk mengakses data absensi secara online di perangkat ini.'}
            </p>

            <div className="rounded-lg bg-[var(--sf2)] border border-[var(--ln)] px-3 py-2.5 text-xs text-[var(--mu)] mb-4 flex items-start gap-2">
              <Cloud className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--pri)]" aria-hidden="true" />
              <span>
                Sinkronisasi Cloud Aktif: login dan data sekolah tersimpan online di Firestore sehingga dapat dibuka di perangkat lain.
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              <div>
                <label htmlFor="em" className="block text-xs font-semibold text-[var(--mu)]">
                  Email sekolah
                </label>
                <input
                  id="em"
                  type="email"
                  autoComplete="username"
                  placeholder="tatausaha@sekolah.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--ln)] bg-[var(--sf)] px-3 py-2 text-sm text-[var(--ink)] font-medium focus:outline-none focus:border-[var(--pri)] focus:ring-2 focus:ring-[var(--pri-b)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="pw" className="text-xs font-semibold text-[var(--mu)]">
                    Password
                  </label>
                  {mode === 'in' && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void runAction(() => onResetPassword(email))}
                      className="text-xs font-semibold text-[var(--pri)] hover:underline cursor-pointer disabled:opacity-60"
                    >
                      Lupa password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="pw"
                    type={showPw ? 'text' : 'password'}
                    autoComplete={mode === 'reg' ? 'new-password' : 'current-password'}
                    placeholder="Minimal 8 karakter"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full rounded-lg border border-[var(--ln)] bg-[var(--sf)] pl-3 pr-10 py-2 text-sm text-[var(--ink)] font-medium focus:outline-none focus:border-[var(--pri)] focus:ring-2 focus:ring-[var(--pri-b)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Sembunyikan password' : 'Lihat password'}
                    aria-pressed={showPw}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-[var(--mu)] hover:text-[var(--ink)] hover:bg-[var(--sf2)] transition cursor-pointer"
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'reg' && (
                <div>
                  <label htmlFor="pw2" className="block text-xs font-semibold text-[var(--mu)]">
                    Ulangi password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="pw2"
                      type={showPw2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Ketik ulang password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      className="w-full rounded-lg border border-[var(--ln)] bg-[var(--sf)] pl-3 pr-10 py-2 text-sm text-[var(--ink)] font-medium focus:outline-none focus:border-[var(--pri)] focus:ring-2 focus:ring-[var(--pri-b)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw2((v) => !v)}
                      aria-label={
                        showPw2 ? 'Sembunyikan ulangi password' : 'Lihat ulangi password'
                      }
                      aria-pressed={showPw2}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-[var(--mu)] hover:text-[var(--ink)] hover:bg-[var(--sf2)] transition cursor-pointer"
                    >
                      {showPw2 ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {notice && (
                <div role="status" className="text-xs font-semibold text-[var(--h)] pt-0.5">
                  {notice}
                </div>
              )}

              {error && (
                <div role="alert" className="text-xs font-semibold text-[var(--a)] pt-0.5">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[40px] rounded-lg bg-[var(--pri-btn)] text-white px-4 py-2 text-sm font-semibold hover:brightness-105 active:translate-y-px transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting ? 'Memproses...' : mode === 'reg' ? 'Buat akun' : 'Masuk'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onToggleMode}
                  className="min-h-[40px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] text-[var(--ink)] px-3.5 py-2 text-sm font-semibold hover:bg-[var(--sf2)] transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {mode === 'reg' ? 'Sudah punya akun' : 'Buat akun baru'}
                </button>
              </div>
            </form>

            <div className="relative my-4 flex items-center">
              <div className="flex-grow border-t border-[var(--ln2)]" />
              <span className="mx-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--mu)]">
                atau
              </span>
              <div className="flex-grow border-t border-[var(--ln2)]" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void runAction(onGoogleLogin)}
              className="w-full inline-flex items-center justify-center gap-2.5 min-h-[40px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] text-[var(--ink)] px-4 py-2 text-sm font-semibold hover:bg-[var(--sf2)] transition cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.37 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </button>
          </>
        )}

        <div className="mt-5 pt-3 border-t border-[var(--ln2)] flex justify-end">
          <button
            type="button"
            onClick={onCycleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ln)] bg-[var(--sf2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--mu)] transition cursor-pointer whitespace-nowrap"
          >
            <ThemeIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{themeLabels[theme]}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
