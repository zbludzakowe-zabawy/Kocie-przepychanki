/* Kocie przepychanki — logika gry (bez DOM). */

const SIZE = 6;
const PIECES_PER_PLAYER = 8;
const MOUSE = 'mouse';
const CAT = 'cat';

const NEIGHBORS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// Kierunki linii: poziomo, pionowo, dwie przekątne.
const LINE_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function inside(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function createGame() {
  const board = [];
  for (let r = 0; r < SIZE; r++) board.push(new Array(SIZE).fill(null));
  return {
    board,
    pools: [
      { mouse: PIECES_PER_PLAYER, cat: 0 },
      { mouse: PIECES_PER_PLAYER, cat: 0 },
    ],
    current: 0,
    phase: 'place', // 'place' | 'choose' | 'line' | 'over'
    winner: null,
    winLine: null,
    nextId: 1,
  };
}

function cloneState(s) {
  return {
    board: s.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    pools: s.pools.map((p) => ({ ...p })),
    current: s.current,
    phase: s.phase,
    winner: s.winner,
    winLine: s.winLine ? s.winLine.map((cell) => cell.slice()) : null,
    nextId: s.nextId,
  };
}

function poolTotal(pool) {
  return pool.mouse + pool.cat;
}

/** Czy dany pionek zostanie odepchnięty przez wstawiany pionek typu `placedType`. */
function isPushable(placedType, piece) {
  return placedType === CAT || piece.type === MOUSE;
}

/**
 * Zwraca listę planowanych przesunięć po wstawieniu pionka typu `type` na (r, c).
 * Każdy element: { from: [r, c], to: [r, c], off: bool, blocked: bool }.
 * Nie modyfikuje stanu — przydaje się też do podglądu w interfejsie.
 */
function previewPushes(state, r, c, type) {
  const result = [];
  for (const [dr, dc] of NEIGHBORS) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inside(nr, nc)) continue;
    const piece = state.board[nr][nc];
    if (!piece || !isPushable(type, piece)) continue;
    const tr = nr + dr;
    const tc = nc + dc;
    const off = !inside(tr, tc);
    const blocked = !off && state.board[tr][tc] !== null;
    result.push({ id: piece.id, from: [nr, nc], to: [tr, tc], off, blocked });
  }
  return result;
}

/** Wszystkie trójki pól w linii (poziomo, pionowo, po skosie). */
const TRIPLES = (function () {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of LINE_DIRS) {
        const cells = [[r, c], [r + dr, c + dc], [r + 2 * dr, c + 2 * dc]];
        if (cells.every(([a, b]) => inside(a, b))) out.push(cells);
      }
    }
  }
  return out;
})();

/** Trójki należące w całości do gracza `owner`. */
function findLines(board, owner) {
  return TRIPLES.filter((cells) =>
    cells.every(([r, c]) => board[r][c] && board[r][c].owner === owner)
  );
}

function canPlace(state, r, c, type) {
  if (state.phase !== 'place') return false;
  if (!inside(r, c) || state.board[r][c]) return false;
  return state.pools[state.current][type] > 0;
}

/**
 * Wstawia pionek bieżącego gracza. Zwraca { state, events } albo null, gdy ruch
 * jest niedozwolony. `events` opisuje, co się stało (do animacji):
 *   placed:   { id, owner, type, at }
 *   pushes:   [{ id, from, to, off }]   (tylko faktycznie wykonane)
 *   promoted: [{ id, owner, at }]        (pionki zamienione w koty i zdjęte z planszy)
 */
function placePiece(state, r, c, type) {
  if (!canPlace(state, r, c, type)) return null;
  const s = cloneState(state);
  const player = s.current;
  const events = { placed: null, pushes: [], promoted: [] };

  // 1. Wstawienie pionka — znika z zasobnika.
  s.pools[player][type]--;
  const piece = { id: s.nextId++, owner: player, type };
  s.board[r][c] = piece;
  events.placed = { id: piece.id, owner: player, type, at: [r, c] };

  // 2. Przepychanie sąsiadów (na podstawie planszy sprzed przesunięć — każdy
  //    sąsiad leci w innym kierunku, więc nie mogą na siebie wpaść).
  const pushes = previewPushes(state, r, c, type);
  for (const p of pushes) {
    if (p.blocked) continue;
    const moving = s.board[p.from[0]][p.from[1]];
    s.board[p.from[0]][p.from[1]] = null;
    if (p.off) {
      // Spadł z planszy — wraca do zasobnika właściciela.
      s.pools[moving.owner][moving.type]++;
    } else {
      s.board[p.to[0]][p.to[1]] = moving;
    }
    events.pushes.push({ id: moving.id, from: p.from, to: p.to, off: p.off });
  }

  // 3. Wygrana: trzy koty w rzędzie — tylko po ruchu ich właściciela.
  //    Koty przeciwnika ustawione w rząd przez przepchnięcie zostają na planszy;
  //    przeciwnik wygra po swoim najbliższym ruchu, jeśli rząd nadal będzie stał.
  const catLine = findLines(s.board, player).find((cells) =>
    cells.every(([a, b]) => s.board[a][b].type === CAT)
  );
  if (catLine) {
    s.phase = 'over';
    s.winner = player;
    s.winLine = catLine;
    return { state: s, events };
  }

  // 4. Wszystkie 8 pionków na planszy — gracz wybiera mysz, która zostanie kotem.
  //    Jeśli jednocześnie ma rząd, wybiera: jeden pionek albo pionki z rzędu.
  if (poolTotal(s.pools[player]) === 0) {
    s.phase = 'choose';
    return { state: s, events };
  }

  // 5. Trzy pionki w rzędzie zamieniają się w koty tylko po ruchu ich właściciela.
  //    Rzędy przeciwnika (np. powstałe przez przepchnięcie) zostają na planszy.
  //    Rząd dłuższy niż 3 — gracz wybiera, które 3 pionki się zamienią (faza 'line').
  resolveLines(s, player, events);
  return { state: s, events };
}

/**
 * Zamienia rzędy gracza `owner` i kończy jego turę. Jeśli któryś rząd jest dłuższy
 * niż 3, nic się jeszcze nie zamienia — gracz najpierw wybiera trzy pionki (faza 'line').
 */
function resolveLines(s, owner, events) {
  if (longRuns(s.board, owner).length) {
    s.phase = 'line';
    return;
  }
  promoteCells(s, owner, lineCells(s.board, owner), events);
  s.phase = 'place';
  s.current = 1 - owner;
}

/** Zdejmuje z planszy pionki z pól `cells` i daje graczowi `owner` tyle kotów. */
function promoteCells(s, owner, cells, events) {
  for (const [a, b] of cells) {
    const p = s.board[a][b];
    s.board[a][b] = null;
    s.pools[owner].cat++;
    events.promoted.push({ id: p.id, owner, at: [a, b] });
  }
}

/**
 * Najdłuższe ciągłe rzędy (co najmniej 3 pola) gracza `owner` w każdym kierunku.
 * Każdy element to lista pól w kolejności wzdłuż rzędu.
 */
function findRuns(board, owner) {
  const own = (r, c) => inside(r, c) && board[r][c] && board[r][c].owner === owner;
  const runs = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of LINE_DIRS) {
        // początek rzędu: własny pionek, a pole przed nim nie jest własne
        if (!own(r, c) || own(r - dr, c - dc)) continue;
        const cells = [];
        for (let a = r, b = c; own(a, b); a += dr, b += dc) cells.push([a, b]);
        if (cells.length >= 3) runs.push(cells);
      }
    }
  }
  return runs;
}

/** Rzędy gracza `owner` dłuższe niż 3 pionki. */
function longRuns(board, owner) {
  return findRuns(board, owner).filter((run) => run.length > 3);
}

/** Pola wszystkich rzędów gracza `owner` (bez powtórzeń). */
function lineCells(board, owner) {
  const cells = new Map();
  for (const line of findLines(board, owner)) {
    for (const [a, b] of line) cells.set(a * SIZE + b, [a, b]);
  }
  return [...cells.values()];
}

/** Pola rzędów bieżącego gracza, które w fazie 'choose' może zamienić zamiast jednego pionka. */
function choosableLineCells(state) {
  if (state.phase !== 'choose') return [];
  return lineCells(state.board, state.current);
}

/**
 * Faza 'choose', gdy gracz ma też rząd: zamiast jednego pionka zamieniają się
 * w koty pionki z rzędu (przy rzędzie dłuższym niż 3 — gracz najpierw wybiera
 * trzy z nich w fazie 'line'). Zwraca { state, events } albo null.
 */
function chooseLines(state) {
  if (!choosableLineCells(state).length) return null;
  const s = cloneState(state);
  const events = { placed: null, pushes: [], promoted: [] };
  resolveLines(s, s.current, events);
  return { state: s, events };
}

/** Pola długich rzędów, spośród których gracz w fazie 'line' wybiera trzy pionki. */
function lineChoiceCells(state) {
  if (state.phase !== 'line') return [];
  const cells = new Map();
  for (const run of longRuns(state.board, state.current)) {
    for (const [a, b] of run) cells.set(a * SIZE + b, [a, b]);
  }
  return [...cells.values()];
}

/**
 * Faza 'line': trzy sąsiednie pionki długiego rzędu, które zamienią się po wskazaniu
 * pola (r, c) — wskazane pole jest środkiem trójki (na końcu rzędu: skrajna trójka).
 * Zwraca listę 3 pól albo null.
 */
function lineTripleAt(state, r, c) {
  if (state.phase !== 'line') return null;
  for (const run of longRuns(state.board, state.current)) {
    const i = run.findIndex(([a, b]) => a === r && b === c);
    if (i < 0) continue;
    const start = Math.min(Math.max(i - 1, 0), run.length - 3);
    return run.slice(start, start + 3);
  }
  return null;
}

/**
 * Faza 'line': zamieniają się w koty trzy pionki długiego rzędu wskazane polem (r, c).
 * Jeśli zostaje jeszcze inny długi rząd, gracz wybiera dalej; w przeciwnym razie
 * zamieniają się pozostałe rzędy po 3 pionki i tura przechodzi na przeciwnika.
 * Zwraca { state, events } albo null.
 */
function chooseTriple(state, r, c) {
  const triple = lineTripleAt(state, r, c);
  if (!triple) return null;
  const s = cloneState(state);
  const events = { placed: null, pushes: [], promoted: [] };
  promoteCells(s, s.current, triple, events);
  resolveLines(s, s.current, events);
  return { state: s, events };
}

/** Pola, które gracz może wskazać w fazie 'choose'. */
function choosableCells(state) {
  if (state.phase !== 'choose') return [];
  const own = [];
  const mice = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = state.board[r][c];
      if (p && p.owner === state.current) {
        own.push([r, c]);
        if (p.type === MOUSE) mice.push([r, c]);
      }
    }
  }
  // Normalnie wybieramy mysz; gdyby na planszy były same koty — dowolny pionek.
  return mice.length ? mice : own;
}

/**
 * Faza 'choose': wskazana mysz zamienia się w kota (zdjęta z planszy, kot trafia
 * do zasobnika). Zwraca { state, events } albo null.
 */
function choosePiece(state, r, c) {
  const allowed = choosableCells(state).some(([a, b]) => a === r && b === c);
  if (!allowed) return null;
  const s = cloneState(state);
  const p = s.board[r][c];
  s.board[r][c] = null;
  s.pools[p.owner].cat++;
  s.phase = 'place';
  s.current = 1 - s.current;
  return { state: s, events: { placed: null, pushes: [], promoted: [{ id: p.id, owner: p.owner, at: [r, c] }] } };
}

/**
 * Sprawdza, czy obiekt (np. odczytany z zapisu w przeglądarce) jest poprawnym
 * stanem gry: plansza 6×6, każdy gracz ma łącznie 8 pionków, poprawna faza.
 */
function isValidState(s) {
  try {
    if (!s || typeof s !== 'object') return false;
    if (!Array.isArray(s.board) || s.board.length !== SIZE) return false;
    if (!Array.isArray(s.pools) || s.pools.length !== 2) return false;
    if (s.current !== 0 && s.current !== 1) return false;
    if (!['place', 'choose', 'line', 'over'].includes(s.phase)) return false;
    if (!Number.isInteger(s.nextId)) return false;
    const totals = [0, 0];
    const ids = new Set();
    for (const row of s.board) {
      if (!Array.isArray(row) || row.length !== SIZE) return false;
      for (const p of row) {
        if (p === null) continue;
        if (!p || (p.owner !== 0 && p.owner !== 1) || (p.type !== MOUSE && p.type !== CAT)) return false;
        if (!Number.isInteger(p.id) || p.id >= s.nextId || ids.has(p.id)) return false;
        ids.add(p.id);
        totals[p.owner]++;
      }
    }
    for (let i = 0; i < 2; i++) {
      const pool = s.pools[i];
      if (!pool || !Number.isInteger(pool.mouse) || !Number.isInteger(pool.cat)) return false;
      if (pool.mouse < 0 || pool.cat < 0) return false;
      totals[i] += pool.mouse + pool.cat;
    }
    if (totals[0] !== PIECES_PER_PLAYER || totals[1] !== PIECES_PER_PLAYER) return false;
    if (s.phase === 'over') {
      return (s.winner === 0 || s.winner === 1) && Array.isArray(s.winLine) && s.winLine.length === 3;
    }
    if (s.phase === 'line' && !longRuns(s.board, s.current).length) return false;
    return s.winner === null || s.winner === undefined;
  } catch {
    return false;
  }
}

export {
  SIZE,
  PIECES_PER_PLAYER,
  MOUSE,
  CAT,
  createGame,
  cloneState,
  canPlace,
  previewPushes,
  placePiece,
  choosableCells,
  choosePiece,
  choosableLineCells,
  chooseLines,
  lineChoiceCells,
  lineTripleAt,
  chooseTriple,
  findLines,
  findRuns,
  poolTotal,
  isValidState,
};
