# Kocie przepychanki

Gra dla dwóch osób (albo jednej osoby z komputerem) w przeglądarce. Plansza 6×6 wygląda jak niebieska, pikowana kołderka.
Gracz pomarańczowy i gracz szary na zmianę stawiają myszy i koty, które się przepychają.

Działa w przeglądarce i na telefonie (PWA, także offline), budowana do jednego pliku
`index.html` i publikowana na GitHub Pages:
**https://zbludzakowe-zabawy.github.io/Kocie-przepychanki/**

## Instalacja jako aplikacja

- **Android / Chrome / Edge:** na dole pojawia się baner „Zainstaluj” (albo menu przeglądarki → „Zainstaluj aplikację”).
- **iPhone / iPad (Safari):** Udostępnij → „Do ekranu początkowego”.

Zainstalowana gra działa bez internetu. Żeby wysłać grę znajomym, stuknij małą ikonę
udostępniania (trzy połączone kropki) w prawym dolnym rogu — na telefonie otworzy się okno
udostępniania, na komputerze link skopiuje się do schowka. Gdy pojawi się nowa wersja, gra pokazuje komunikat
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
   trafiają koty, które można potem postawić. Jeśli rząd jest dłuższy niż 3, gracz **wybiera
   tylko 3 sąsiednie pionki** z tego rzędu (wskazuje środek trójki) i tylko one się zamieniają;
   pozostałe zostają na planszy. Zamiana następuje **tylko po ruchu gracza, do którego należą
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

## Gra z komputerem

Przycisk **„Nowa gra”** otwiera **Menu gry**:

- **Liczba graczy:** 1 gracz (z komputerem) albo 2 graczy (gra jak dotąd, dwie osoby przy jednym ekranie).
- **Twój kolor** (tylko przy 1 graczu): pomarańczowy (zaczyna) albo szary — wtedy pierwszy ruch
  robi komputer.
- **Poziom komputera** (tylko przy 1 graczu): bardzo łatwy, łatwy, średni, trudny, bardzo trudny.
  - bardzo łatwy — losowe ruchy,
  - łatwy — patrzy na własny ruch, ale często się myli,
  - średni — wybiera najlepszy własny ruch (np. zawsze wykorzysta wygraną),
  - trudny — przewiduje odpowiedź przeciwnika (broni się przed wygraną),
  - bardzo trudny — przewiduje kilka ruchów naprzód (do ok. 2 s myślenia).

Ustawienia zapisują się razem z partią. „Cofnij” w grze z komputerem cofa też jego odpowiedź,
aż znów będzie Twój ruch.

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
  ai.js              komputer: 5 poziomów (minimax z cięciami alfa-beta), bez DOM
  ui.js              plansza, animacje, cofanie, autozapis partii, menu gry, ruchy komputera
  pwa.js             instalacja i komunikat „Dostępna nowa wersja”
  share.js           ikona „Udostępnij” (okno systemowe albo kopiowanie linku)
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
