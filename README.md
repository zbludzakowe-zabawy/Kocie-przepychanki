# Kocie przepychanki

Gra dla dwóch osób w przeglądarce. Plansza 6×6 wygląda jak niebieska, pikowana kołderka.
Gracz pomarańczowy i gracz szary na zmianę stawiają myszy i koty, które się przepychają.

Działa w przeglądarce i na telefonie (PWA, także offline), budowana do jednego pliku
`index.html` i publikowana na GitHub Pages:
**https://zbludzakowe-zabawy.github.io/Kocie-przepychanki/**

## Instalacja jako aplikacja

- **Android / Chrome / Edge:** na dole pojawia się baner „Zainstaluj” (albo menu przeglądarki → „Zainstaluj aplikację”).
- **iPhone / iPad (Safari):** Udostępnij → „Do ekranu początkowego”.

Zainstalowana gra działa bez internetu. Gdy pojawi się nowa wersja, gra pokazuje komunikat
„Dostępna nowa wersja” z przyciskiem „Odśwież”. Bieżąca partia zapisuje się w przeglądarce
i wraca po odświeżeniu lub ponownym otwarciu.

## Uruchomienie

```bash
npm install
npm run dev          # serwer deweloperski
npm run build        # dist/index.html + manifest, ikony, service worker
npm run preview      # podgląd zbudowanej wersji na porcie 4173
```

## Zasady

1. Każdy gracz zaczyna z **8 myszami** w zasobniku. Zaczyna gracz pomarańczowy.
2. Gracze na zmianę stawiają jeden pionek ze swojego zasobnika na wolnym polu.
   Postawiony pionek znika z zasobnika.
3. **Mysz** odpycha o jedno pole wszystkie sąsiednie **myszy** (8 pól dookoła, obu graczy).
   Kotów nie rusza.
4. **Kot** odpycha o jedno pole wszystkie sąsiednie pionki: **koty i myszy**.
5. Pionek się nie przesuwa, jeśli pole za nim jest zajęte (nie ma przepychania łańcuchowego).
6. Pionek wypchnięty poza planszę wraca do zasobnika swojego właściciela.
7. **Trzy pionki jednego gracza w rzędzie** (poziomo, pionowo lub po skosie, myszy i koty
   w dowolnej kombinacji) zamieniają się w koty: schodzą z planszy, a do zasobnika
   trafiają koty, które można potem postawić. Jeśli rząd jest dłuższy niż 3, zamieniają się
   wszystkie jego pionki. Zamiana następuje **tylko po ruchu gracza, do którego należą
   pionki w rzędzie**. Jeśli rząd powstał w wyniku ruchu przeciwnika (przez przepchnięcie),
   pionki się nie zamieniają i zostają na planszy; zamienią się po najbliższym ruchu
   właściciela, jeśli rząd nadal będzie stał.
8. Gdy gracz po swoim ruchu ma **wszystkie 8 pionków na planszy**, wybiera jedną swoją mysz,
   która zamienia się w kota (schodzi z planszy, a kot trafia do zasobnika). Jeśli w tym
   samym momencie ma też **trzy pionki w rzędzie**, wybiera: zamienia się jeden wskazany
   przez niego pionek albo pionki z rzędu.
9. **Wygrywa** ten, kto ustawi w rzędzie **trzy swoje koty**. Wygrana liczy się **tylko po ruchu
   gracza, do którego należą koty**. Jeśli trzy koty ustawią się w rzędzie w wyniku ruchu
   przeciwnika (przez przepchnięcie), gra toczy się dalej: właściciel kotów wygrywa po swoim
   najbliższym ruchu, jeśli rząd nadal będzie stał.

W grze można cofać ruchy (przycisk „Cofnij”). Po najechaniu na pole widać, które pionki
zostaną przepchnięte (żółta obwódka) i które spadną z planszy (czerwona obwódka).

## Testy

```bash
npm test             # testy jednostkowe (node --test, tests/unit)
npm run test:e2e     # testy w przeglądarce (Playwright, tests/e2e) – komputer i telefon
npm run test:all     # wszystko po kolei
```

Przed pierwszym `test:e2e`: `npx playwright install chromium`.

## Struktura

```
index.html           strona, grafiki pionków (SVG), banery instalacji i aktualizacji
src/
  logic.js           zasady gry – czysta logika bez DOM, pokryta testami
  ui.js              plansza, animacje, cofanie, autozapis partii
  pwa.js             instalacja i komunikat „Dostępna nowa wersja”
  storage.js         zapis w przeglądarce (localStorage)
  sw-template.js     service worker (działanie offline), wersja nadawana przy buildzie
  style.css          wygląd
public/              manifest i ikony aplikacji
tests/
  unit/              testy jednostkowe
  e2e/               Playwright
```

## Jednorazowa konfiguracja GitHub Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Licencja

BSD 2-Clause – zobacz [LICENSE](LICENSE).
