/**
 * Aplikacja do zainstalowania (PWA): baner „Zainstaluj” i komunikat o nowej wersji.
 * Logika decyzji jest czysta i ma testy; `initPwa` podpina ją do strony.
 */

/** iPhone/iPad Safari nie pokazuje okna instalacji — potrzebne „Udostępnij → Do ekranu początkowego”. */
export function isIos(userAgent, maxTouchPoints) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS przedstawia się jako Mac; zdradza go obsługa dotyku.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** 'prompt' | 'ios' | 'none' */
export function installMode({ standalone, dismissed, hasPrompt, userAgent, maxTouchPoints }) {
  if (standalone || dismissed) return 'none';
  if (hasPrompt) return 'prompt';
  // Inne przeglądarki na iOS (CriOS, FxiOS) nie dodają pewnie do ekranu — podpowiedź tylko w Safari.
  if (isIos(userAgent, maxTouchPoints) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent)) return 'ios';
  return 'none';
}

/**
 * Wywołuje `onUpdate(worker)`, gdy nowy service worker czeka, a stronę obsługuje
 * starszy (czyli prawdziwa aktualizacja, nie pierwsza instalacja).
 */
export function watchForUpdates(reg, hasController, onUpdate) {
  if (reg.waiting && hasController()) onUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && hasController()) onUpdate(w);
    });
  });
}

export function initPwa({ loadPref, savePref }) {
  const $ = (id) => document.getElementById(id);
  const installBanner = $('install-banner');
  const updateBanner = $('update-banner');
  let deferred = null;

  const standalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

  const refreshInstall = () => {
    const mode = installMode({
      standalone: standalone(),
      dismissed: loadPref('installDismissed', false),
      hasPrompt: !!deferred,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
    });
    installBanner.hidden = mode === 'none';
    installBanner.dataset.mode = mode;
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    refreshInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installBanner.hidden = true;
  });
  $('btn-install').addEventListener('click', async () => {
    if (!deferred) return;
    const ev = deferred;
    deferred = null;
    installBanner.hidden = true; // okno instalacji można pokazać tylko raz na zdarzenie
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
  });
  $('btn-install-close').addEventListener('click', () => {
    savePref('installDismissed', true);
    installBanner.hidden = true;
  });
  refreshInstall();

  // Service worker: działanie bez internetu + komunikat o nowej wersji. Tylko w zbudowanej aplikacji.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let waiting = null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading && waiting) {
      reloading = true;
      window.location.reload();
    }
  });
  $('btn-update').addEventListener('click', () => {
    updateBanner.hidden = true;
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
  $('btn-update-later').addEventListener('click', () => {
    updateBanner.hidden = true;
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      watchForUpdates(reg, () => !!navigator.serviceWorker.controller, (w) => {
        waiting = w;
        updateBanner.hidden = false;
      });
      // Szukaj nowej wersji po powrocie do aplikacji i co godzinę.
      const check = () => reg.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
      });
      setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => undefined);
}
