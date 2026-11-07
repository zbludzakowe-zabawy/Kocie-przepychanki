# Kocie przepychanki

Gra dla dwóch osób w przeglądarce. Plansza 6×6 wygląda jak niebieska, pikowana kołderka.
Gracz pomarańczowy i gracz szary na zmianę stawiają myszy i koty, które się przepychają.

## Jak uruchomić

Otwórz `index.html` w przeglądarce. Nie trzeba niczego instalować ani budować.

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
   wszystkie jego pionki. Liczą się też rzędy powstałe przez przepchnięcie,
   również rzędy przeciwnika.
8. Gdy gracz ma **wszystkie 8 pionków na planszy**, wybiera jedną swoją mysz, która
   zamienia się w kota (schodzi z planszy, a kot trafia do zasobnika).
9. **Wygrywa** ten, kto ustawi w rzędzie **trzy swoje koty**. Jeśli po ruchu obaj gracze mają
   trzy koty w rzędzie, wygrywa gracz, który wykonał ruch.

W grze można cofać ruchy (przycisk „Cofnij”). Po najechaniu na pole widać, które pionki
zostaną przepchnięte (żółta obwódka) i które spadną z planszy (czerwona obwódka).

## Struktura

- `index.html`, `css/style.css`: strona i wygląd planszy
- `js/logic.js`: zasady gry (czysta logika bez DOM, działa też w Node)
- `js/ui.js`: interfejs i animacje
- `tests/logic.test.js`: testy logiki

## Testy

```bash
npm test
```
