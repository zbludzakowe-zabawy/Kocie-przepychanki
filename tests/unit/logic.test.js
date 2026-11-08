import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../src/logic.js';

/** Pomocnik: ustawia pionek bezpośrednio na planszy (z pominięciem zasobnika). */
function put(state, r, c, owner, type) {
  state.board[r][c] = { id: state.nextId++, owner, type };
  state.pools[owner][type === L.CAT ? 'cat' : 'mouse'] -= type === L.CAT ? 0 : 1;
  return state.board[r][c];
}

function count(state, owner) {
  let n = 0;
  for (const row of state.board) for (const p of row) if (p && p.owner === owner) n++;
  return n + L.poolTotal(state.pools[owner]);
}

test('start: 8 myszy w zasobniku każdego gracza, zaczyna gracz pomarańczowy (0)', () => {
  const s = L.createGame();
  assert.deepEqual(s.pools, [{ mouse: 8, cat: 0 }, { mouse: 8, cat: 0 }]);
  assert.equal(s.current, 0);
  assert.equal(s.board.length, 6);
  assert.ok(s.board.every((row) => row.length === 6 && row.every((x) => x === null)));
});

test('wstawienie pionka zdejmuje go z zasobnika i zmienia gracza', () => {
  const { state } = L.placePiece(L.createGame(), 2, 2, L.MOUSE);
  assert.equal(state.pools[0].mouse, 7);
  assert.equal(state.board[2][2].owner, 0);
  assert.equal(state.current, 1);
});

test('nie można postawić na zajętym polu ani bez pionka w zasobniku', () => {
  let s = L.placePiece(L.createGame(), 2, 2, L.MOUSE).state;
  assert.equal(L.placePiece(s, 2, 2, L.MOUSE), null);
  assert.equal(L.placePiece(s, 3, 3, L.CAT), null); // brak kotów
});

test('mysz odpycha sąsiednie myszy (wszystkie 8 kierunków), ale nie koty', () => {
  const s = L.createGame();
  put(s, 1, 1, 1, L.MOUSE);
  put(s, 1, 2, 1, L.MOUSE);
  put(s, 2, 3, 0, L.MOUSE);
  const cat = put(s, 3, 2, 1, L.CAT);
  const { state } = L.placePiece(s, 2, 2, L.MOUSE);
  assert.equal(state.board[0][0].owner, 1); // z (1,1) po skosie
  assert.equal(state.board[0][2].owner, 1); // z (1,2) w górę
  assert.equal(state.board[2][4].owner, 0); // własna mysz też się odsuwa
  assert.equal(state.board[3][2].id, cat.id); // kot stoi
  assert.equal(state.board[1][1], null);
});

test('kot odpycha wszystkie sąsiednie pionki (koty i myszy)', () => {
  const s = L.createGame();
  s.pools[0].cat = 1;
  s.pools[0].mouse = 7;
  put(s, 3, 2, 1, L.CAT);
  put(s, 2, 1, 1, L.MOUSE);
  const { state } = L.placePiece(s, 2, 2, L.CAT);
  assert.equal(state.board[4][2].type, L.CAT);
  assert.equal(state.board[2][0].type, L.MOUSE);
  assert.equal(state.pools[0].cat, 0);
});

test('pionek nie przesuwa się, gdy pole za nim jest zajęte', () => {
  const s = L.createGame();
  put(s, 2, 3, 1, L.MOUSE);
  put(s, 2, 4, 1, L.MOUSE);
  const { state } = L.placePiece(s, 2, 2, L.MOUSE);
  assert.equal(state.board[2][3].owner, 1);
  assert.equal(state.board[2][4].owner, 1);
});

test('pionek wypchnięty poza planszę wraca do zasobnika właściciela', () => {
  const s = L.createGame();
  s.pools[0].cat = 1;
  s.pools[0].mouse = 7;
  put(s, 0, 1, 1, L.CAT);
  s.pools[1].mouse = 8; // put() nie zdejmuje kotów; zasobnik 1 nadal ma 8 myszy
  put(s, 1, 0, 1, L.MOUSE);
  const { state, events } = L.placePiece(s, 1, 1, L.CAT);
  assert.equal(state.board[0][1], null);
  assert.equal(state.board[1][0], null);
  assert.equal(state.pools[1].cat, 1);
  assert.equal(state.pools[1].mouse, 8);
  assert.equal(events.pushes.filter((p) => p.off).length, 2);
});

test('trzy pionki w rzędzie zamieniają się w koty i wracają do zasobnika', () => {
  const s = L.createGame();
  put(s, 4, 0, 0, L.MOUSE);
  put(s, 4, 1, 0, L.MOUSE);
  const { state, events } = L.placePiece(s, 4, 2, L.MOUSE);
  assert.equal(state.board[4][0], null);
  assert.equal(state.board[4][1], null);
  assert.equal(state.board[4][2], null);
  assert.equal(state.pools[0].cat, 3);
  assert.equal(state.pools[0].mouse, 5);
  assert.equal(events.promoted.length, 3);
  assert.equal(count(state, 0), 8);
});

test('mieszana trójka (kot + myszy) też zamienia się w koty', () => {
  const s = L.createGame();
  s.pools[0] = { mouse: 6, cat: 0 };
  s.board[0][0] = { id: 90, owner: 0, type: L.CAT };
  s.board[1][1] = { id: 91, owner: 0, type: L.MOUSE };
  const { state } = L.placePiece(s, 5, 5, L.MOUSE); // daleko, nic nie popycha
  assert.equal(state.board[0][0].type, L.CAT); // jeszcze nie ma trójki
  const s2 = L.createGame();
  s2.pools[0] = { mouse: 6, cat: 0 };
  s2.board[0][0] = { id: 90, owner: 0, type: L.CAT };
  s2.board[0][1] = { id: 91, owner: 0, type: L.MOUSE };
  const r = L.placePiece(s2, 0, 3, L.MOUSE); // (0,2) pusty -> brak trójki
  assert.equal(r.state.pools[0].cat, 0);
  const s3 = L.createGame();
  s3.pools[0] = { mouse: 6, cat: 0 };
  s3.board[0][0] = { id: 90, owner: 0, type: L.CAT };
  s3.board[2][0] = { id: 91, owner: 0, type: L.MOUSE };
  const r3 = L.placePiece(s3, 1, 0, L.MOUSE); // mysz nie rusza kota, ale pcha mysz (2,0) -> (3,0)
  assert.equal(r3.state.board[3][0].owner, 0);
  assert.equal(r3.state.pools[0].cat, 0);
});

test('trójka utworzona ruchem przeciwnika się nie zamienia (czeka na ruch właściciela)', () => {
  const s = L.createGame();
  put(s, 0, 0, 1, L.MOUSE);
  put(s, 0, 1, 1, L.MOUSE);
  put(s, 1, 3, 1, L.MOUSE);
  // pomarańczowy stawia mysz na (2,4): mysz szarego z (1,3) leci na (0,2)
  const { state, events } = L.placePiece(s, 2, 4, L.MOUSE);
  assert.equal(state.board[0][2].owner, 1);
  assert.equal(L.findLines(state.board, 1).length, 1);
  assert.equal(state.pools[1].cat, 0);
  assert.equal(events.promoted.length, 0);
  // szary wykonuje dowolny ruch daleko od rzędu — teraz jego trójka się zamienia
  const r = L.placePiece(state, 5, 5, L.MOUSE);
  assert.equal(r.state.pools[1].cat, 3);
  assert.equal(r.state.board[0][0], null);
  assert.equal(r.state.board[0][2], null);
  assert.equal(r.events.promoted.length, 3);
});

test('ruch gracza nie zamienia trójki przeciwnika, nawet gdy obaj mają rząd', () => {
  const s = L.createGame();
  put(s, 5, 0, 1, L.MOUSE);
  put(s, 5, 1, 1, L.MOUSE);
  put(s, 5, 2, 1, L.MOUSE);
  put(s, 0, 0, 0, L.MOUSE);
  put(s, 0, 1, 0, L.MOUSE);
  const { state, events } = L.placePiece(s, 0, 2, L.MOUSE);
  assert.equal(state.pools[0].cat, 3); // trójka gracza wykonującego ruch — zamiana
  assert.equal(state.pools[1].cat, 0); // trójka przeciwnika zostaje
  assert.equal(state.board[5][1].owner, 1);
  assert.ok(events.promoted.every((p) => p.owner === 0));
});

test('trzy koty w rzędzie — wygrana', () => {
  const s = L.createGame();
  s.pools[0] = { mouse: 5, cat: 1 };
  s.board[3][0] = { id: 90, owner: 0, type: L.CAT };
  s.board[3][1] = { id: 91, owner: 0, type: L.CAT };
  const { state } = L.placePiece(s, 3, 3, L.CAT); // (3,2) puste -> brak
  assert.equal(state.phase, 'place');
  const s2 = L.createGame();
  s2.pools[0] = { mouse: 5, cat: 1 };
  s2.board[0][0] = { id: 90, owner: 0, type: L.CAT };
  s2.board[1][1] = { id: 91, owner: 0, type: L.CAT };
  const r = L.placePiece(s2, 2, 2, L.CAT); // kot pcha (1,1) na (0,0)? zajęte -> stoi
  assert.equal(r.state.phase, 'over');
  assert.equal(r.state.winner, 0);
  assert.equal(r.state.winLine.length, 3);
});

test('trzy koty przeciwnika ustawione przepchnięciem — wygrana dopiero po jego ruchu', () => {
  const s = L.createGame();
  s.pools[0] = { mouse: 7, cat: 1 };
  s.pools[1] = { mouse: 5, cat: 0 };
  s.board[0][0] = { id: 90, owner: 1, type: L.CAT };
  s.board[0][1] = { id: 91, owner: 1, type: L.CAT };
  s.board[1][2] = { id: 92, owner: 1, type: L.CAT };
  s.nextId = 100;
  // pomarańczowy kot na (2,2) wypycha szarego kota z (1,2) na (0,2) — rząd szarych kotów
  const r = L.placePiece(s, 2, 2, L.CAT);
  assert.equal(r.state.board[0][2].id, 92);
  assert.equal(r.state.phase, 'place'); // brak wygranej po ruchu przeciwnika
  assert.equal(r.state.winner, null);
  assert.equal(r.state.current, 1);
  assert.equal(L.findLines(r.state.board, 1).length, 1); // rząd zostaje na planszy

  // szary wykonuje dowolny ruch — rząd nadal stoi, więc wygrywa
  const r2 = L.placePiece(r.state, 5, 5, L.MOUSE);
  assert.equal(r2.state.phase, 'over');
  assert.equal(r2.state.winner, 1);
  assert.deepEqual(r2.state.winLine, [[0, 0], [0, 1], [0, 2]]);
});

test('8 pionków na planszy — gracz wybiera mysz, która staje się kotem', () => {
  const s = L.createGame();
  // pomarańczowy ma 7 myszy rozstawionych bez trójek, 1 w zasobniku
  const spots = [[0, 0], [0, 2], [0, 4], [2, 0], [2, 4], [4, 0], [4, 2]];
  for (const [r, c] of spots) put(s, r, c, 0, L.MOUSE);
  assert.equal(s.pools[0].mouse, 1);
  const { state } = L.placePiece(s, 5, 5, L.MOUSE);
  assert.equal(state.phase, 'choose');
  assert.equal(state.current, 0);
  assert.equal(L.choosableCells(state).length, 8);
  assert.equal(L.choosePiece(state, 1, 1), null); // puste pole
  const after = L.choosePiece(state, 0, 0).state;
  assert.equal(after.board[0][0], null);
  assert.deepEqual(after.pools[0], { mouse: 0, cat: 1 });
  assert.equal(after.phase, 'place');
  assert.equal(after.current, 1);
});

test('8 pionków na planszy i rząd — gracz wybiera jeden pionek albo rząd', () => {
  // 7 myszy pomarańczowego, w tym (0,0) i (0,1); ostatnia mysz na (0,2) domknie rząd
  const spots = [[0, 0], [0, 1], [2, 0], [2, 4], [4, 0], [4, 2], [4, 4]];
  const setup = () => {
    const s = L.createGame();
    for (const [r, c] of spots) put(s, r, c, 0, L.MOUSE);
    return s;
  };

  // bez rzędu: zwykły wybór myszy, opcja rzędu niedostępna
  const plain = L.placePiece(setup(), 0, 3, L.MOUSE).state;
  assert.equal(plain.phase, 'choose');
  assert.equal(L.choosableLineCells(plain).length, 0);
  assert.equal(L.chooseLines(plain), null);

  const { state, events } = L.placePiece(setup(), 0, 2, L.MOUSE); // (0,1) stoi, bo (0,0) zajęte
  assert.equal(events.promoted.length, 0); // nic nie zamienia się samo
  assert.equal(state.phase, 'choose');
  assert.equal(state.current, 0);
  assert.equal(L.choosableLineCells(state).length, 3);
  assert.equal(L.choosableCells(state).length, 8);

  // wariant A: zamieniają się pionki z rzędu
  const a = L.chooseLines(state);
  assert.equal(a.events.promoted.length, 3);
  assert.deepEqual(a.state.pools[0], { mouse: 0, cat: 3 });
  assert.equal(a.state.board[0][0], null);
  assert.equal(a.state.phase, 'place');
  assert.equal(a.state.current, 1);

  // wariant B: zamienia się jeden wskazany pionek, rząd zostaje na planszy
  const b = L.choosePiece(state, 4, 4);
  assert.deepEqual(b.state.pools[0], { mouse: 0, cat: 1 });
  assert.equal(L.findLines(b.state.board, 0).length, 1);
  assert.equal(b.state.phase, 'place');
  assert.equal(b.state.current, 1);
});

test('liczba pionków każdego gracza zawsze wynosi 8 (losowe partie)', () => {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let g = 0; g < 200; g++) {
    let s = L.createGame();
    for (let move = 0; move < 300 && s.phase !== 'over'; move++) {
      if (s.phase === 'choose' && L.choosableLineCells(s).length && rand() < 0.5) {
        s = L.chooseLines(s).state;
      } else if (s.phase === 'choose') {
        const cells = L.choosableCells(s);
        const [r, c] = cells[Math.floor(rand() * cells.length)];
        s = L.choosePiece(s, r, c).state;
      } else {
        const empty = [];
        for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!s.board[r][c]) empty.push([r, c]);
        const pool = s.pools[s.current];
        const types = [];
        if (pool.mouse) types.push(L.MOUSE);
        if (pool.cat) types.push(L.CAT);
        const [r, c] = empty[Math.floor(rand() * empty.length)];
        const t = types[Math.floor(rand() * types.length)];
        s = L.placePiece(s, r, c, t).state;
      }
      assert.equal(count(s, 0), 8);
      assert.equal(count(s, 1), 8);
    }
  }
});

test('isValidState: przyjmuje stany z gry, odrzuca uszkodzone', () => {
  let s = L.createGame();
  assert.equal(L.isValidState(s), true);
  s = L.placePiece(s, 2, 2, L.MOUSE).state;
  assert.equal(L.isValidState(JSON.parse(JSON.stringify(s))), true);
  assert.equal(L.isValidState(null), false);
  assert.equal(L.isValidState({}), false);
  const broken = L.cloneState(s);
  broken.pools[0].mouse = 8; // 9 pionków
  assert.equal(L.isValidState(broken), false);
  const badPhase = L.cloneState(s);
  badPhase.phase = 'cokolwiek';
  assert.equal(L.isValidState(badPhase), false);
  const dupId = L.cloneState(s);
  dupId.board[0][0] = { ...dupId.board[2][2] };
  dupId.pools[0].mouse--;
  assert.equal(L.isValidState(dupId), false);
});
