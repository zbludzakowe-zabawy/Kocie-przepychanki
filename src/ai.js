/* Kocie przepychanki — automatyczny gracz (komputer). Czysta logika, bez DOM. */
import * as L from './logic.js';

/** Poziomy trudności: klucz → nazwa wyświetlana w menu. */
export const LEVELS = [
  { id: 1, name: 'bardzo łatwy' },
  { id: 2, name: 'łatwy' },
  { id: 3, name: 'średni' },
  { id: 4, name: 'trudny' },
  { id: 5, name: 'bardzo trudny' },
];

const WIN = 100000;

/** Wszystkie trójki pól w linii (poziomo, pionowo, po skosie). */
const TRIPLES = (function () {
  const out = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < L.SIZE; r++) {
    for (let c = 0; c < L.SIZE; c++) {
      for (const [dr, dc] of dirs) {
        const cells = [[r, c], [r + dr, c + dc], [r + 2 * dr, c + 2 * dc]];
        if (cells.every(([a, b]) => a >= 0 && a < L.SIZE && b >= 0 && b < L.SIZE)) out.push(cells);
      }
    }
  }
  return out;
})();

/**
 * Wszystkie decyzje, które bieżący gracz może podjąć w danym stanie:
 *   { kind: 'place', r, c, type }  — postawienie pionka (faza 'place')
 *   { kind: 'choose', r, c }       — wskazanie myszy, która zostanie kotem (faza 'choose')
 *   { kind: 'lines' }              — zamiana pionków z rzędu (faza 'choose')
 *   { kind: 'triple', r, c }       — wybór trójki z długiego rzędu (faza 'line')
 */
export function legalActions(state) {
  const out = [];
  if (state.phase === 'place') {
    const pool = state.pools[state.current];
    for (let r = 0; r < L.SIZE; r++) {
      for (let c = 0; c < L.SIZE; c++) {
        if (state.board[r][c]) continue;
        if (pool.mouse > 0) out.push({ kind: 'place', r, c, type: L.MOUSE });
        if (pool.cat > 0) out.push({ kind: 'place', r, c, type: L.CAT });
      }
    }
  } else if (state.phase === 'choose') {
    for (const [r, c] of L.choosableCells(state)) out.push({ kind: 'choose', r, c });
    if (L.choosableLineCells(state).length) out.push({ kind: 'lines' });
  } else if (state.phase === 'line') {
    const seen = new Set();
    for (const [r, c] of L.lineChoiceCells(state)) {
      const triple = L.lineTripleAt(state, r, c);
      const key = triple.map(([a, b]) => a * L.SIZE + b).sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: 'triple', r, c });
    }
  }
  return out;
}

/** Wykonuje decyzję. Zwraca { state, events } (jak funkcje z logic.js) albo null. */
export function applyAction(state, a) {
  switch (a.kind) {
    case 'place': return L.placePiece(state, a.r, a.c, a.type);
    case 'choose': return L.choosePiece(state, a.r, a.c);
    case 'lines': return L.chooseLines(state);
    case 'triple': return L.chooseTriple(state, a.r, a.c);
    default: return null;
  }
}

/** Ocena pozycji z punktu widzenia gracza `me` (więcej = lepiej). */
export function evaluate(state, me) {
  if (state.phase === 'over') return state.winner === me ? WIN : -WIN;
  return side(state, me) - side(state, 1 - me);
}

function side(state, p) {
  const b = state.board;
  const toMove = state.current === p;
  // Koty nigdy nie wracają do bycia myszami — każdy kot to trwały postęp.
  let score = state.pools[p].cat * 12;
  for (const row of b) {
    for (const x of row) {
      if (x && x.owner === p) score += x.type === L.CAT ? 13 : 1;
    }
  }
  const catsInPool = state.pools[p].cat > 0;
  for (const cells of TRIPLES) {
    let own = 0;
    let cats = 0;
    let empty = 0;
    for (const [r, c] of cells) {
      const x = b[r][c];
      if (!x) empty++;
      else if (x.owner === p) {
        own++;
        if (x.type === L.CAT) cats++;
      } else {
        own = -9; // pionek przeciwnika blokuje trójkę
      }
    }
    if (own < 0) continue;
    if (own === 3) {
      // Rząd ułożony przepchnięciem — zamieni się (albo wygra) po ruchu właściciela.
      score += cats === 3 ? (toMove ? 2000 : 60) : 10;
    } else if (own === 2 && empty === 1) {
      score += 3;
      if (cats === 2) score += catsInPool ? 12 : 5;
    } else if (own === 1 && empty === 2) {
      score += cats ? 1 : 0.4;
    }
  }
  return score;
}

class Timeout extends Error {}

/**
 * Minimax z cięciami alfa-beta. Głębokość liczy tylko postawienia pionków;
 * dodatkowe decyzje tego samego gracza (faza 'choose' / 'line') jej nie zmniejszają.
 */
function search(state, depth, alpha, beta, me, ctx) {
  if (state.phase === 'over') return state.winner === me ? WIN + depth : -WIN - depth;
  if (depth <= 0 && state.phase === 'place') return evaluate(state, me);
  if (++ctx.nodes % 256 === 0 && Date.now() > ctx.deadline) throw new Timeout();

  const maximizing = state.current === me;
  const children = [];
  for (const a of legalActions(state)) {
    const res = applyAction(state, a);
    if (res) children.push({ a, s: res.state });
  }
  if (!children.length) return evaluate(state, me);
  if (depth >= 2) {
    for (const ch of children) ch.e = evaluate(ch.s, me);
    children.sort((x, y) => (maximizing ? y.e - x.e : x.e - y.e));
  }

  let best = maximizing ? -Infinity : Infinity;
  for (const { a, s } of children) {
    const v = search(s, a.kind === 'place' ? depth - 1 : depth, alpha, beta, me, ctx);
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Ustawienia poziomów: głębokość szukania, szum w ocenie, szansa na losowy ruch, limit czasu. */
const PROFILES = {
  1: { depth: 0, noise: 0, random: 1, time: 0 },
  2: { depth: 1, noise: 30, random: 0.35, time: 0 },
  3: { depth: 1, noise: 4, random: 0, time: 0 },
  4: { depth: 2, noise: 0, random: 0, time: 1500 },
  5: { depth: 4, noise: 0, random: 0, time: 1800 },
};

/**
 * Wybiera decyzję komputera dla bieżącego gracza na danym poziomie (1–5).
 * `rng`, `timeLimit` i `maxDepth` można podmienić (testy). Zwraca akcję albo null, gdy nie ma ruchu.
 */
export function chooseAction(state, level = 3, { rng = Math.random, timeLimit, maxDepth } = {}) {
  const prof = PROFILES[level] || PROFILES[3];
  const depthLimit = maxDepth ?? prof.depth;
  const actions = shuffle(legalActions(state), rng);
  if (!actions.length) return null;
  if (actions.length === 1) return actions[0];
  if (rng() < prof.random) return actions[0];

  const me = state.current;
  const children = [];
  for (const a of actions) {
    const res = applyAction(state, a);
    if (res) children.push({ a, s: res.state });
  }

  if (prof.depth <= 1) {
    // Patrzymy tylko na własny ruch (łącznie z ewentualnymi dalszymi decyzjami w tej turze).
    const ctx = { nodes: 0, deadline: Infinity };
    let best = null;
    let bestV = -Infinity;
    for (const { a, s } of children) {
      const v = search(s, 0, -Infinity, Infinity, me, ctx) + (rng() * 2 - 1) * prof.noise;
      if (v > bestV) {
        bestV = v;
        best = a;
      }
    }
    return best;
  }

  // Głębsze poziomy: pogłębianie iteracyjne z limitem czasu.
  for (const ch of children) ch.v = evaluate(ch.s, me);
  children.sort((x, y) => y.v - x.v);
  const deadline = Date.now() + (timeLimit ?? prof.time);
  let best = children[0].a;
  for (let depth = 2; depth <= depthLimit; depth++) {
    const ctx = { nodes: 0, deadline };
    try {
      let alpha = -Infinity;
      for (const ch of children) {
        // głębokość pozostała po naszym postawieniu pionka (dalsze decyzje w tej turze jej nie zmieniają)
        const rest = ch.a.kind === 'place' ? depth - 1 : depth;
        ch.v = search(ch.s, rest, alpha, Infinity, me, ctx);
        if (ch.v > alpha) alpha = ch.v;
      }
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
    // stabilne sortowanie: przy równych ocenach zostaje kolejność z poprzedniej iteracji
    children.sort((x, y) => y.v - x.v);
    best = children[0].a;
    if (children[0].v >= WIN) break; // znaleziona wygrana
  }
  return best;
}
