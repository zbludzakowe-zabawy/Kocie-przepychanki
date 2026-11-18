/* Udostępnianie gry. Zawsze stały adres opublikowanej strony (nie location.href –
 * podgląd i testy działają pod innym adresem). Telefon: systemowe okno udostępniania;
 * komputer: kopiowanie do schowka + komunikat; na końcu komunikat z adresem.
 * Anulowanie okna udostępniania (AbortError) to nie błąd. */
export const SHARE_URL = 'https://zbludzakowe-zabawy.github.io/Kocie-przepychanki/';
const SHARE = {
  title: 'Kocie przepychanki',
  text: 'Zagraj w Kocie przepychanki – myszy i koty przepychają się na pikowanej kołderce!',
  url: SHARE_URL,
};

export function initShare() {
  let timer;
  function toast(msg, ms) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, ms);
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share(SHARE);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      toast('Skopiowano link – wklej go w wiadomości', 3500);
    } catch {
      toast(`Adres: ${SHARE_URL}`, 6000);
    }
  }
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', share));
}
