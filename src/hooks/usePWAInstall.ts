import { useCallback, useEffect, useState } from 'react';
import {
  detectInstallPlatform,
  isEmbeddedIframe,
  isStandaloneDisplay,
  shouldAutoShowPwaPopup,
  type InstallAttemptResult,
  type InstallPlatform,
} from '../utils/pwaHelpers';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __simsDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() =>
      typeof window !== 'undefined' ? window.__simsDeferredPrompt || null : null
    );
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [inIframe, setInIframe] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    const isStandalone = isStandaloneDisplay(window);
    setIsInstalled(isStandalone);

    setPlatform(detectInstallPlatform(window.navigator.userAgent));
    setInIframe(isEmbeddedIframe(window));

    if (window.__simsDeferredPrompt) {
      setDeferredPrompt(window.__simsDeferredPrompt);
    }

    let showTimer: number | null = null;
    if (shouldAutoShowPwaPopup({ isInstalled: isStandalone })) {
      showTimer = window.setTimeout(() => {
        setIsPopupOpen(true);
      }, 350);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__simsDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__simsDeferredPrompt = null;
      setIsPopupOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const openPopup = useCallback(() => {
    setIsPopupOpen(true);
  }, []);

  const openPopupOnEntry = useCallback(() => {
    if (shouldAutoShowPwaPopup({ isInstalled: isStandaloneDisplay(window) })) {
      setIsPopupOpen(true);
    }
  }, []);

  const closePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  const install = useCallback(async (): Promise<InstallAttemptResult> => {
    const promptToUse = deferredPrompt || window.__simsDeferredPrompt || null;
    if (!promptToUse) return 'unavailable';

    await promptToUse.prompt();
    const { outcome } = await promptToUse.userChoice;
    setDeferredPrompt(null);
    window.__simsDeferredPrompt = null;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsPopupOpen(false);
      return 'installed';
    }
    return 'dismissed';
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS: platform === 'ios',
    platform,
    inIframe,
    isPopupOpen,
    openPopup,
    openPopupOnEntry,
    closePopup,
    install,
  };
}
