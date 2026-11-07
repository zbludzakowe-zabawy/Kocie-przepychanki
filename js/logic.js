/*
 * Kocie przepychanki — logika gry (bez DOM).
 * Działa w przeglądarce (window.KocieLogic) oraz w Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.KocieLogic = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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
      phase: 'place', // 'place' | 'choose' | 'over'
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

    // 3. Wygrana: trzy koty w rzędzie (pierwszeństwo ma gracz wykonujący ruch).
    for (const owner of [player, 1 - player]) {
      const catLine = findLines(s.board, owner).find((cells) =>
        cells.every(([a, b]) => s.board[a][b].type === CAT)
      );
      if (catLine) {
        s.phase = 'over';
        s.winner = owner;
        s.winLine = catLine;
        return { state: s, events };
      }
    }

    // 4. Trzy pionki gracza w rzędzie — zamieniają się w koty (wracają do zasobnika).
    for (const owner of [player, 1 - player]) {
      const lines = findLines(s.board, owner);
      const cells = new Map();
      for (const line of lines) {
        for (const [a, b] of line) cells.set(a * SIZE + b, [a, b]);
      }
      for (const [a, b] of cells.values()) {
        const p = s.board[a][b];
        s.board[a][b] = null;
        s.pools[owner].cat++;
        events.promoted.push({ id: p.id, owner, at: [a, b] });
      }
    }

    // 5. Wszystkie 8 pionków na planszy — gracz wybiera mysz, która zostanie kotem.
    if (poolTotal(s.pools[player]) === 0) {
      s.phase = 'choose';
      return { state: s, events };
    }

    s.current = 1 - player;
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

  return {
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
    findLines,
    poolTotal,
  };
});
