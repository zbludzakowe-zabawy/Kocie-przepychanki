/* Kocie przepychanki — interfejs w przeglądarce. */
(function () {
  'use strict';
  const L = window.KocieLogic;
  const SIZE = L.SIZE;
  const NAMES = ['pomarańczowy', 'szary'];
  const COLORS = ['var(--orange)', 'var(--gray)'];

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const undoBtn = document.getElementById('btn-undo');
  const linesBtn = document.getElementById('btn-lines');
  const panels = [document.getElementById('player-0'), document.getElementById('player-1')];

  let state = L.createGame();
  let history = [];
  let selected = [L.MOUSE, L.MOUSE];
  let animating = false;
  let hoverCell = null;

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
        btn.disabled = state.pools[i][type] === 0 || state.current !== i || state.phase !== 'place';
        btn.classList.toggle('selected', selected[i] === type && state.phase === 'place' && state.current === i);
      }
    });
  }

  function renderStatus() {
    const dot = (i) => `<span class="dot" style="background:${COLORS[i]}"></span>`;
    const p = state.current;
    if (state.phase === 'over') {
      statusEl.innerHTML = `${dot(state.winner)}Wygrywa gracz ${NAMES[state.winner]}! Trzy koty w rzędzie! 🎉`;
    } else if (state.phase === 'choose' && L.choosableLineCells(state).length) {
      statusEl.innerHTML = `${dot(p)}Gracz ${NAMES[p]} ma wszystkie pionki na planszy i pionki w rzędzie — wskaż jeden pionek albo zamień pionki z rzędu.`;
    } else if (state.phase === 'choose') {
      statusEl.innerHTML = `${dot(p)}Gracz ${NAMES[p]} ma wszystkie pionki na planszy — wybierz mysz, która zmieni się w kota.`;
    } else {
      const what = selected[p] === L.CAT ? 'kota' : 'mysz';
      statusEl.innerHTML = `${dot(p)}Ruch: gracz ${NAMES[p]} — postaw ${what} na wolnym polu.`;
    }
  }

  function updateHints() {
    for (const cell of cells) {
      cell.classList.remove('hover-ok', 'hover-bad', 'will-push', 'will-fall', 'choosable', 'in-line');
    }
    if (animating) return;
    if (state.phase === 'choose') {
      for (const [r, c] of L.choosableCells(state)) cellAt(r, c).classList.add('choosable');
      for (const [r, c] of L.choosableLineCells(state)) cellAt(r, c).classList.add('in-line');
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
    syncPieces();
    renderPanels();
    renderStatus();
    updateHints();
    undoBtn.disabled = history.length === 0 || animating;
    renderLinesBtn();
  }

  function renderLinesBtn() {
    linesBtn.hidden = animating || L.choosableLineCells(state).length === 0;
  }

  // ---------- animacja ruchu ----------
  async function animate(events) {
    animating = true;
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
    animating = false;
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
    if (animating) return;
    if (state.phase === 'place') {
      apply(L.placePiece(state, r, c, selected[state.current]));
    } else if (state.phase === 'choose') {
      apply(L.choosePiece(state, r, c));
    }
  }

  panels.forEach((panel, i) => {
    for (const btn of panel.querySelectorAll('.pool-btn')) {
      btn.addEventListener('click', () => {
        if (state.current !== i || state.phase !== 'place') return;
        selected[i] = btn.dataset.type;
        renderPanels();
        renderStatus();
        updateHints();
      });
    }
  });

  linesBtn.addEventListener('click', () => {
    if (animating) return;
    apply(L.chooseLines(state));
  });

  undoBtn.addEventListener('click', () => {
    if (animating || !history.length) return;
    state = history.pop();
    for (const el of pieceEls.values()) el.remove();
    pieceEls.clear();
    render();
  });

  document.getElementById('btn-new').addEventListener('click', () => {
    if (animating) return;
    if (history.length && state.phase !== 'over' && !confirm('Zacząć nową grę?')) return;
    state = L.createGame();
    history = [];
    selected = [L.MOUSE, L.MOUSE];
    for (const el of pieceEls.values()) el.remove();
    pieceEls.clear();
    render();
  });

  const rules = document.getElementById('rules');
  document.getElementById('btn-rules').addEventListener('click', () => rules.showModal());

  render();
})();
