import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Smartphone,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  getManualInstallHint,
  type InstallAttemptResult,
  type InstallPlatform,
} from '../utils/pwaHelpers';

interface PWAPromptModalProps {
  open: boolean;
  isInstallable: boolean;
  platform: InstallPlatform;
  inIframe: boolean;
  onInstall: () => Promise<InstallAttemptResult>;
  onClose: () => void;
}

export const PWAPromptModal: React.FC<PWAPromptModalProps> = ({
  open,
  isInstallable,
  platform,
  inIframe,
  onInstall,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [showFallbackGuide, setShowFallbackGuide] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowFallbackGuide(false);
      setStatusMessage('');
      setCopiedLink(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleDownloadClick = async () => {
    setDownloading(true);
    setStatusMessage('');
    try {
      const outcome = await onInstall();
      if (outcome === 'dismissed') {
        setStatusMessage('Instalasi dibatalkan. Klik Download Aplikasi lagi kapan saja.');
      } else if (outcome === 'unavailable') {
        setShowFallbackGuide(true);
        setStatusMessage(getManualInstallHint({ platform, inIframe }));
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-prompt-title"
      aria-describedby="pwa-prompt-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5 sm:p-6 shadow-2xl text-[var(--ink)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pop-up download aplikasi"
          className="absolute right-3.5 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--mu)] hover:bg-[var(--sf2)] hover:text-[var(--ink)] transition cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3.5 pr-8">
          <div
            aria-hidden="true"
            className="w-13 h-13 rounded-xl bg-[#0f243e] grid place-items-center shrink-0 shadow-xs"
          >
            <svg viewBox="0 0 512 512" className="w-10 h-10">
              <rect
                x="96"
                y="96"
                width="320"
                height="320"
                rx="52"
                fill="none"
                stroke="#ffffff"
                strokeWidth="36"
              />
              <path
                d="M178 262l54 54 106-114"
                fill="none"
                stroke="#34d399"
                strokeWidth="42"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2
              id="pwa-prompt-title"
              className="text-base sm:text-lg font-extrabold tracking-tight leading-snug"
            >
              Download Aplikasi SIMS Absensi
            </h2>
            <p className="text-xs font-medium text-[var(--mu)] mt-0.5">
              Aplikasi Web (PWA) · Ringan &amp; Tanpa Play Store
            </p>
          </div>
        </div>

        <p
          id="pwa-prompt-desc"
          className="mt-3.5 text-xs sm:text-sm text-[var(--mu)] leading-relaxed"
        >
          Pasang <strong className="text-[var(--ink)]">SIMS Absensi</strong> di HP atau laptop
          untuk memudahkan absensi harian lebih cepat dan langsung terbuka seperti aplikasi biasa.
        </p>

        <ul className="mt-3.5 space-y-2 rounded-xl border border-[var(--ln2)] bg-[var(--sf2)] p-3.5 text-xs text-[var(--ink)]">
          <li className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-[var(--pri)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>Akses 1 ketukan langsung dari Layar Utama HP atau Desktop.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-[var(--h)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>Input kehadiran, waktu izin, &amp; foto surat lebih cepat tanpa buka tab browser.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <WifiOff className="w-4 h-4 text-[var(--s)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>Tetap dapat mencatat absensi saat offline dan tersinkronisasi saat online.</span>
          </li>
        </ul>

        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadClick()}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[42px] rounded-xl bg-[var(--pri-btn)] text-white px-4 py-2.5 text-sm font-bold hover:brightness-105 active:translate-y-px transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {downloading
                ? 'Menyiapkan...'
                : isInstallable
                  ? 'Download & Install Aplikasi'
                  : 'Download Aplikasi'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-[var(--ln)] bg-[var(--sf)] text-[var(--ink)] px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-[var(--sf2)] transition cursor-pointer"
          >
            Nanti saja
          </button>
        </div>

        {(statusMessage || showFallbackGuide) && (
          <div
            role="status"
            className="mt-3.5 rounded-xl border border-[var(--pri)]/25 bg-[var(--pri-b)] p-3.5 text-xs text-[var(--ink)] space-y-2"
          >
            <div className="flex items-start gap-2 font-semibold text-[var(--pri)] leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{statusMessage}</span>
            </div>

            {showFallbackGuide && !inIframe && (
              <ol className="list-decimal list-inside space-y-1 text-[var(--mu)] leading-relaxed pl-0.5">
                {platform === 'ios' ? (
                  <>
                    <li>
                      Ketuk ikon <strong className="text-[var(--ink)]">Bagikan (Share)</strong> di bilah Safari.
                    </li>
                    <li>
                      Pilih <strong className="text-[var(--ink)]">Tambahkan ke Layar Utama</strong> lalu ketuk{' '}
                      <strong className="text-[var(--ink)]">Tambah</strong>.
                    </li>
                  </>
                ) : platform === 'android' ? (
                  <>
                    <li>
                      Ketuk menu titik tiga (<strong className="text-[var(--ink)]">⋮</strong>) di pojok kanan atas Chrome.
                    </li>
                    <li>
                      Pilih <strong className="text-[var(--ink)]">Install aplikasi</strong> atau{' '}
                      <strong className="text-[var(--ink)]">Tambahkan ke Layar Utama</strong>.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      Klik ikon <strong className="text-[var(--ink)]">Install</strong> di ujung kanan address bar browser.
                    </li>
                    <li>
                      Atau buka menu (<strong className="text-[var(--ink)]">⋮</strong>) →{' '}
                      <strong className="text-[var(--ink)]">Simpan dan bagikan / Install SIMS Absensi</strong>.
                    </li>
                  </>
                )}
              </ol>
            )}

            {showFallbackGuide && (
              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ln)] bg-[var(--sf)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sf2)] transition cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--h)]" aria-hidden="true" />
                    <span>Link aplikasi disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Salin Link Aplikasi</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
