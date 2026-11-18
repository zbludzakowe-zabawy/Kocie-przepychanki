/* Kocie przepychanki — interfejs w przeglądarce. */
import * as L from './logic.js';
import { loadPref, savePref } from './storage.js';
import { chooseAction, applyAction, LEVELS } from './ai.js';

export function initGame() {
  const SIZE = L.SIZE;
  const NAMES = ['pomarańczowy', 'szary'];
  const COLORS = ['var(--orange)', 'var(--gray)'];

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const undoBtn = document.getElementById('btn-undo');
  const linesBtn = document.getElementById('btn-lines');
  const panels = [document.getElementById('player-0'), document.getElementById('player-1')];

  const SAVE_KEY = 'game';
  const SETTINGS_KEY = 'settings';
  const MAX_HISTORY = 200;
  // players: 1 (z komputerem) albo 2; human: kolor gracza-człowieka (0 = pomarańczowy, zaczyna);
  // level: poziom komputera 1–5.
  const DEFAULT_SETTINGS = { players: 2, human: 0, level: 3 };
  const validSettings = (x) =>
    !!x && (x.players === 1 || x.players === 2) && (x.human === 0 || x.human === 1) &&
    LEVELS.some((l) => l.id === x.level);
  let settings = loadPref(SETTINGS_KEY, null);
  if (!validSettings(settings)) settings = { ...DEFAULT_SETTINGS };
  let state = L.createGame();
  let history = [];
  // Partia zapisuje się w przeglądarce i wraca po odświeżeniu / ponownym otwarciu aplikacji.
  const saved = loadPref(SAVE_KEY, null);
  if (saved && L.isValidState(saved.state)) {
    state = saved.state;
    history = Array.isArray(saved.history) ? saved.history.filter(L.isValidState).slice(-MAX_HISTORY) : [];
    // ustawienia trwającej partii (gra z komputerem wraca po odświeżeniu)
    if (validSettings(saved.settings)) settings = { ...saved.settings };
  }
  const save = () => savePref(SAVE_KEY, { state, history: history.slice(-MAX_HISTORY), settings });
  let selected = [L.MOUSE, L.MOUSE];
  let animating = false;
  let hoverCell = null;
  let aiTimer = null; // zaplanowany ruch komputera
  let aiGen = 0; // licznik unieważniający zaplanowany ruch (cofnięcie, nowa gra)

  const solo = () => settings.players === 1;
  const aiPlayer = () => 1 - settings.human;
  const isAi = (i) => solo() && i === aiPlayer();
  const isAiTurn = () => state.phase !== 'over' && isAi(state.current);
  const levelName = () => LEVELS.find((l) => l.id === settings.level).name;

  const ANIM = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 280;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const nextFrame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

  // ---------- budowa planszy ----------
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute('aria-label', `Pole ${'ABCDEF'[c]}${r + 1}`);
      cell.addEventListener('click', () => onCellClick(r, c));
      cell.addEventListener('mouseenter', () => { hoverCell = [r, c]; updateHints(); });
      cell.addEventListener('mouseleave', () => { hoverCell = null; updateHints(); });
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }
  // guziczki kołderki na wewnętrznych przecięciach szwów
  for (let r = 1; r < SIZE; r++) {
    for (let c = 1; c < SIZE; c++) {
      const t = document.createElement('span');
      t.className = 'tuft';
      t.style.left = `${(c * 100) / SIZE}%`;
      t.style.top = `${(r * 100) / SIZE}%`;
      boardEl.appendChild(t);
    }
  }
  const piecesEl = document.createElement('div');
  piecesEl.className = 'pieces';
  boardEl.appendChild(piecesEl);
  const pieceEls = new Map();

  const cellAt = (r, c) => cells[r * SIZE + c];

  function makePieceEl(piece, r, c) {
    const el = document.createElement('div');
    el.innerHTML = '<svg><use/></svg>';
    setPiece(el, piece, r, c);
    piecesEl.appendChild(el);
    pieceEls.set(piece.id, el);
    return el;
  }

  function setPiece(el, piece, r, c) {
    el.className = `piece p${piece.owner}`;
    el.querySelector('use').setAttribute('href', piece.type === L.CAT ? '#icon-cat' : '#icon-mouse');
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
  }

  /** Dopasowuje elementy pionków do stanu (bez animacji wejścia). */
  function syncPieces() {
    const seen = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        seen.add(p.id);
        const el = pieceEls.get(p.id);
        if (el) setPiece(el, p, r, c);
        else makePieceEl(p, r, c);
      }
    }
    for (const [id, el] of pieceEls) {
      if (!seen.has(id)) {
        el.remove();
        pieceEls.delete(id);
      }
    }
    if (state.winLine) {
      for (const [r, c] of state.winLine) pieceEls.get(state.board[r][c].id).classList.add('win');
    }
  }

  // ---------- panele, status, podpowiedzi ----------
  function ensureSelection(player) {
    const pool = state.pools[player];
    if (pool[selected[player]] === 0) {
      selected[player] = pool.mouse > 0 ? L.MOUSE : L.CAT;
    }
  }

  function renderPanels() {
    panels.forEach((panel, i) => {
      ensureSelection(i);
      panel.classList.toggle('active', state.phase !== 'over' && state.current === i);
      for (const btn of panel.querySelectorAll('.pool-btn')) {
        const type = btn.dataset.type;
        btn.querySelector('.count').textContent = state.pools[i][type];
        btn.disabled = state.pools[i][type] === 0 || state.current !== i || state.phase !== 'place' || isAi(i);
        btn.classList.toggle('selected', selected[i] === type && state.phase === 'place' && state.current === i);
      }
      panel.querySelector('.who').textContent = !solo() ? '' : isAi(i) ? `(komputer, ${levelName()})` : '(Ty)';
    });
  }

  function renderStatus() {
    const dot = (i) => `<span class="dot" style="background:${COLORS[i]}"></span>`;
    const p = state.current;
    if (solo()) {
      statusEl.innerHTML = dot(state.phase === 'over' ? state.winner : p) + soloStatus();
      return;
    }
    if (state.phase === 'over') {
      statusEl.innerHTML = `${dot(state.winner)}Wygrywa gracz ${NAMES[state.winner]}! Trzy koty w rzędzie! 🎉`;
    } else if (state.phase === 'line') {
      statusEl.innerHTML = `${dot(p)}Gracz ${NAMES[p]} ma więcej niż 3 pionki w rzędzie — wskaż środek trójki, która zmieni się w koty.`;
    } else if (state.phase === 'choose' && L.choosableLineCells(state).length) {
      statusEl.innerHTML = `${dot(p)}Gracz ${NAMES[p]} ma wszystkie pionki na planszy i pionki w rzędzie — wskaż jeden pionek albo zamień pionki z rzędu.`;
    } else if (state.phase === 'choose') {
      statusEl.innerHTML = `${dot(p)}Gracz ${NAMES[p]} ma wszystkie pionki na planszy — wybierz mysz, która zmieni się w kota.`;
    } else {
      const what = selected[p] === L.CAT ? 'kota' : 'mysz';
      statusEl.innerHTML = `${dot(p)}Ruch: gracz ${NAMES[p]} — postaw ${what} na wolnym polu.`;
    }
  }

  /** Komunikat w grze z komputerem (zamiast „gracz pomarańczowy / szary”). */
  function soloStatus() {
    if (state.phase === 'over') {
      return isAi(state.winner)
        ? 'Wygrywa komputer — trzy koty w rzędzie. Spróbuj jeszcze raz!'
        : 'Wygrywasz! Trzy koty w rzędzie! 🎉';
    }
    if (isAiTurn()) return `Komputer (${NAMES[state.current]}) myśli…`;
    if (state.phase === 'line') return 'Masz więcej niż 3 pionki w rzędzie — wskaż środek trójki, która zmieni się w koty.';
    if (state.phase === 'choose' && L.choosableLineCells(state).length) {
      return 'Masz wszystkie pionki na planszy i pionki w rzędzie — wskaż jeden pionek albo zamień pionki z rzędu.';
    }
    if (state.phase === 'choose') return 'Masz wszystkie pionki na planszy — wybierz mysz, która zmieni się w kota.';
    const what = selected[state.current] === L.CAT ? 'kota' : 'mysz';
    return `Twój ruch (${NAMES[state.current]}) — postaw ${what} na wolnym polu.`;
  }

  function updateHints() {
    for (const cell of cells) {
      cell.classList.remove('hover-ok', 'hover-bad', 'will-push', 'will-fall', 'choosable', 'in-line');
    }
    if (animating || isAiTurn()) return;
    if (state.phase === 'choose') {
      for (const [r, c] of L.choosableCells(state)) cellAt(r, c).classList.add('choosable');
      for (const [r, c] of L.choosableLineCells(state)) cellAt(r, c).classList.add('in-line');
      return;
    }
    if (state.phase === 'line') {
      for (const [r, c] of L.lineChoiceCells(state)) cellAt(r, c).classList.add('in-line');
      const triple = hoverCell && L.lineTripleAt(state, hoverCell[0], hoverCell[1]);
      for (const [r, c] of triple || []) cellAt(r, c).classList.add('choosable');
      return;
    }
    if (state.phase !== 'place' || !hoverCell) return;
    const [r, c] = hoverCell;
    const type = selected[state.current];
    if (!L.canPlace(state, r, c, type)) {
      cellAt(r, c).classList.add('hover-bad');
      return;
    }
    cellAt(r, c).classList.add('hover-ok');
    for (const p of L.previewPushes(state, r, c, type)) {
      if (p.blocked) continue;
      cellAt(p.from[0], p.from[1]).classList.add(p.off ? 'will-fall' : 'will-push');
    }
  }

  function render() {
    save();
    syncPieces();
    renderPanels();
    renderStatus();
    updateHints();
    undoBtn.disabled = !canUndo() || animating;
    renderLinesBtn();
    scheduleAi();
  }

  function renderLinesBtn() {
    linesBtn.hidden = animating || isAiTurn() || L.choosableLineCells(state).length === 0;
  }

  /** W grze z komputerem cofamy się do ostatniej decyzji człowieka (razem z ruchem komputera). */
  function canUndo() {
    if (!solo()) return history.length > 0;
    return history.some((s) => s.current === settings.human);
  }

  // ---------- animacja ruchu ----------
  function setBusy(v) {
    animating = v;
    updateBusy();
  }

  // plansza jest „zajęta” w trakcie animacji i gdy komputer ma zaplanowany ruch
  function updateBusy() {
    if (animating || aiTimer) boardEl.dataset.busy = '1';
    else delete boardEl.dataset.busy;
  }

  // ---------- ruch komputera ----------
  function scheduleAi() {
    if (!isAiTurn() || animating || aiTimer) return;
    const gen = ++aiGen;
    // krótka pauza, żeby było widać, co się dzieje (dalsze decyzje w tej samej turze szybciej)
    const delay = state.phase === 'place' ? 450 : 300;
    aiTimer = setTimeout(() => {
      if (gen !== aiGen) return;
      const action = chooseAction(state, settings.level);
      aiTimer = null;
      if (gen !== aiGen || !action) {
        updateBusy();
        return;
      }
      apply(applyAction(state, action));
    }, delay);
    updateBusy();
  }

  function cancelAi() {
    aiGen++;
    clearTimeout(aiTimer);
    aiTimer = null;
    updateBusy();
  }

  async function animate(events) {
    setBusy(true);
    updateHints();
    if (events.placed) {
      const { id, owner, type, at } = events.placed;
      const el = makePieceEl({ id, owner, type }, at[0], at[1]);
      el.classList.add('enter');
      await wait(ANIM * 0.6);
    }
    if (events.pushes.length) {
      await nextFrame();
      for (const p of events.pushes) {
        const el = pieceEls.get(p.id);
        if (!el) continue;
        el.style.setProperty('--r', p.to[0]);
        el.style.setProperty('--c', p.to[1]);
        if (p.off) el.classList.add('leaving');
      }
      await wait(ANIM);
    }
    if (events.promoted.length) {
      await wait(ANIM * 0.5);
      for (const p of events.promoted) {
        const el = pieceEls.get(p.id);
        if (!el) continue;
        el.querySelector('use').setAttribute('href', '#icon-cat');
        el.classList.add('promote');
      }
      await wait(ANIM * 1.4);
    }
    setBusy(false);
  }

  async function apply(result) {
    if (!result) return;
    history.push(state);
    const events = result.events;
    state = result.state;
    renderPanels();
    renderStatus();
    undoBtn.disabled = true;
    linesBtn.hidden = true;
    await animate(events);
    render();
  }

  // ---------- obsługa zdarzeń ----------
  function onCellClick(r, c) {
    if (animating || isAiTurn()) return;
    if (state.phase === 'place') {
      apply(L.placePiece(state, r, c, selected[state.current]));
    } else if (state.phase === 'choose') {
      apply(L.choosePiece(state, r, c));
    } else if (state.phase === 'line') {
      apply(L.chooseTriple(state, r, c));
    }
  }

  panels.forEach((panel, i) => {
    for (const btn of panel.querySelectorAll('.pool-btn')) {
      btn.addEventListener('click', () => {
        if (state.current !== i || state.phase !== 'place' || isAi(i)) return;
        selected[i] = btn.dataset.type;
        renderPanels();
        renderStatus();
        updateHints();
      });
    }
  });

  linesBtn.addEventListener('click', () => {
    if (animating || isAiTurn()) return;
    apply(L.chooseLines(state));
  });

  undoBtn.addEventListener('click', () => {
    if (animating || !canUndo()) return;
    cancelAi();
    state = history.pop();
    // z komputerem: cofamy też jego ruchy, aż znów będzie kolej człowieka
    while (solo() && state.current !== settings.human && history.length) state = history.pop();
    for (const el of pieceEls.values()) el.remove();
    pieceEls.clear();
    render();
  });

  // ---------- menu gry ----------
  const menu = document.getElementById('menu');
  const menuForm = menu.querySelector('form');
  const radio = (name) => menuForm.querySelector(`input[name="${name}"]:checked`);
  function syncMenu() {
    const one = radio('players').value === '1';
    for (const el of menuForm.querySelectorAll('.only-solo')) el.hidden = !one;
  }
  menuForm.addEventListener('change', syncMenu);

  document.getElementById('btn-new').addEventListener('click', () => {
    if (animating) return;
    for (const [name, value] of Object.entries(settings)) {
      const input = menuForm.querySelector(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    }
    syncMenu();
    document.getElementById('menu-note').hidden = !(history.length && state.phase !== 'over');
    menu.returnValue = '';
    menu.showModal();
  });

  menu.addEventListener('close', () => {
    if (menu.returnValue !== 'start') return;
    settings = {
      players: Number(radio('players').value),
      human: Number(radio('human').value),
      level: Number(radio('level').value),
    };
    savePref(SETTINGS_KEY, settings);
    newGame();
  });

  function newGame() {
    cancelAi();
    state = L.createGame();
    history = [];
    selected = [L.MOUSE, L.MOUSE];
    for (const el of pieceEls.values()) el.remove();
    pieceEls.clear();
    render();
  }

  const rules = document.getElementById('rules');
  document.getElementById('btn-rules').addEventListener('click', () => rules.showModal());

  render();
}
