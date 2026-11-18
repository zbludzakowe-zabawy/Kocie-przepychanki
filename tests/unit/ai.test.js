import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../src/logic.js';
import { chooseAction, applyAction, legalActions, LEVELS } from '../../src/ai.js';

/** Prosty deterministyczny generator liczb losowych (powtarzalne testy). */
function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

function emptyGame() {
  return L.createGame();
}

function put(s, r, c, owner, type) {
  s.board[r][c] = { id: s.nextId++, owner, type };
}

/** Rozgrywa partię komputer kontra komputer; zwraca poziom zwycięzcy albo null (remis po limicie). */
function play(levelOrange, levelGray, seed) {
  const rng = seeded(seed);
  let s = L.createGame();
  for (let k = 0; k < 400 && s.phase !== 'over'; k++) {
    const level = s.current === 0 ? levelOrange : levelGray;
    const a = chooseAction(s, level, { rng, timeLimit: 400 });
    const res = applyAction(s, a);
    assert.ok(res, `niedozwolony ruch komputera: ${JSON.stringify(a)}`);
    s = res.state;
    assert.ok(L.isValidState(s));
  }
  return s.phase === 'over' ? s.winner : null;
}

test('5 poziomów trudności', () => {
  assert.deepEqual(LEVELS.map((l) => l.name), ['bardzo łatwy', 'łatwy', 'średni', 'trudny', 'bardzo trudny']);
});

test('legalActions: postawienia na wolnych polach, myszy i koty z zasobnika', () => {
  const s = emptyGame();
  assert.equal(legalActions(s).length, 36); // tylko myszy
  s.pools[0].cat = 1;
  s.pools[0].mouse = 7;
  put(s, 0, 0, 1, L.MOUSE);
  assert.equal(legalActions(s).length, 35 * 2);
});

test('komputer na każdym poziomie gra zgodnie z zasadami aż do końca partii', () => {
  for (const { id } of LEVELS) {
    const winner = play(id, id, 1000 + id);
    assert.ok(winner === 0 || winner === 1 || winner === null);
  }
});

test('komputer obsługuje fazy wyboru: mysz na kota, rząd, trójka z długiego rzędu', () => {
  // faza 'choose' z rzędem
  let s = emptyGame();
  for (const [r, c] of [[0, 0], [0, 1], [2, 0], [2, 4], [4, 0], [4, 2], [4, 4]]) put(s, r, c, 0, L.MOUSE);
  s.pools[0].mouse = 1;
  s = L.placePiece(s, 0, 2, L.MOUSE).state;
  assert.equal(s.phase, 'choose');
  for (const { id } of LEVELS) {
    const a = chooseAction(s, id, { rng: seeded(id) });
    assert.ok(['choose', 'lines'].includes(a.kind));
    assert.ok(applyAction(s, a));
  }

  // faza 'line'
  s = emptyGame();
  put(s, 1, 0, 0, L.MOUSE);
  put(s, 1, 1, 0, L.CAT);
  put(s, 1, 3, 0, L.CAT);
  s.pools[0].mouse = 5;
  s = L.placePiece(s, 1, 2, L.MOUSE).state;
  assert.equal(s.phase, 'line');
  assert.equal(legalActions(s).length, 2); // dwie różne trójki w rzędzie 4
  for (const { id } of LEVELS) {
    const a = chooseAction(s, id, { rng: seeded(id) });
    assert.equal(a.kind, 'triple');
    assert.ok(applyAction(s, a));
  }
});

test('od poziomu średniego komputer wykorzystuje wygraną w jednym ruchu', () => {
  const s = emptyGame();
  put(s, 0, 0, 0, L.CAT);
  put(s, 0, 1, 0, L.CAT);
  put(s, 5, 5, 1, L.MOUSE);
  s.pools[0] = { mouse: 5, cat: 1 };
  s.pools[1] = { mouse: 7, cat: 0 };
  for (const level of [3, 4, 5]) {
    for (let seed = 1; seed <= 5; seed++) {
      const a = chooseAction(s, level, { rng: seeded(seed) });
      const res = applyAction(s, a).state;
      assert.equal(res.phase, 'over', `poziom ${level}: ${JSON.stringify(a)}`);
      assert.equal(res.winner, 0);
    }
  }
});

test('poziom trudny broni się przed wygraną przeciwnika w jednym ruchu', () => {
  // szary ma koty (5,0), (5,1) i kota w zasobniku — grozi kotem na (5,2)
  const s = emptyGame();
  put(s, 5, 0, 1, L.CAT);
  put(s, 5, 1, 1, L.CAT);
  put(s, 0, 5, 0, L.MOUSE);
  s.pools[0] = { mouse: 7, cat: 0 };
  s.pools[1] = { mouse: 5, cat: 1 };
  for (const level of [4, 5]) {
    for (let seed = 1; seed <= 3; seed++) {
      const a = chooseAction(s, level, { rng: seeded(seed) });
      const after = applyAction(s, a).state;
      // żadna odpowiedź szarego nie może dać mu wygranej
      const loses = legalActions(after).some((b) => {
        const r = applyAction(after, b).state;
        return r.phase === 'over' && r.winner === 1;
      });
      assert.equal(loses, false, `poziom ${level}: ${JSON.stringify(a)}`);
    }
  }
});

test('wyższy poziom wygrywa z niższym', () => {
  const pairs = [[2, 1], [3, 2], [4, 3]];
  for (const [hi, lo] of pairs) {
    let wins = 0;
    const games = 6;
    for (let g = 0; g < games; g++) {
      // na zmianę kolorami
      const winner = g % 2 ? play(lo, hi, g) : play(hi, lo, g);
      if (winner === (g % 2 ? 1 : 0)) wins++;
    }
    assert.ok(wins >= games - 1, `poziom ${hi} wygrał z ${lo} tylko ${wins}/${games}`);
  }
});
