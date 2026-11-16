import React from 'react';
import { Download } from 'lucide-react';
import type { InstallAttemptResult } from '../utils/pwaHelpers';

interface PWAInstallButtonProps {
  compact?: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => Promise<InstallAttemptResult>;
  onOpenPopup: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  isInstallable,
  isInstalled,
  onInstall,
  onOpenPopup,
}) => {
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await onInstall();
      if (outcome === 'unavailable') {
        onOpenPopup();
      }
    } else {
      onOpenPopup();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      title="Download / Install aplikasi SIMS Absensi (PWA)"
      aria-label="Download Aplikasi"
      className={
        isInstallable
          ? 'inline-flex items-center gap-1.5 rounded-lg bg-[var(--pri-btn)] text-white px-2.5 py-1.5 text-xs font-semibold hover:brightness-105 transition cursor-pointer whitespace-nowrap shrink-0'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--pri)]/35 bg-[var(--pri-b)] px-2.5 py-1.5 text-xs font-semibold text-[var(--pri)] hover:brightness-95 transition cursor-pointer whitespace-nowrap shrink-0'
      }
    >
      <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className={compact ? 'hidden sm:inline' : ''}>
        {isInstallable ? 'Install App' : 'Download App'}
      </span>
    </button>
  );
};
