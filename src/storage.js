/* Zapis w przeglądarce (localStorage). Każdy odczyt i zapis może się nie udać
 * (tryb prywatny, zablokowane dane strony) — wtedy gra działa bez zapisu. */
const PREFIX = 'kocie-przepychanki:';

export function loadPref(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* brak miejsca lub zablokowany zapis — pomijamy */
  }
}
