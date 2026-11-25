import { test, expect } from '@playwright/test';

const cell = (page, r, c) => ({
  // klik, potem czekamy na koniec animacji ruchu (w jej trakcie plansza ignoruje kliknięcia)
  click: async () => {
    await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).click();
    await expect(page.locator('#board:not([data-busy])')).toBeVisible();
  },
});
const pieceAt = (page, r, c) =>
  page.locator(`.piece[style*="--r: ${r};"][style*="--c: ${c};"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  // czysty stan; baner zgody na statystyki zasłania planszę, więc odpowiedź „nie” jest już zapisana
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('zz-analytics-consent', 'denied'); });
  await page.reload();
});

test('stawianie i przepychanie myszy', async ({ page }) => {
  await expect(page.locator('#status')).toContainText('gracz pomarańczowy');
  await cell(page, 2, 2).click();
  await expect(page.locator('#status')).toContainText('gracz szary');
  await expect(page.locator('#player-0 [data-count="mouse"]')).toHaveText('7');

  // szara mysz obok — pomarańczowa odsuwa się w prawo
  await cell(page, 2, 1).click();
  await expect(pieceAt(page, 2, 3)).toHaveClass(/p0/);
  await expect(page.locator('.piece')).toHaveCount(2);
});

test('partia wraca po odświeżeniu strony', async ({ page }) => {
  await cell(page, 0, 0).click();
  await cell(page, 5, 5).click();
  await expect(page.locator('.piece')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.piece')).toHaveCount(2);
  await expect(page.locator('#status')).toContainText('gracz pomarańczowy');
  await page.locator('#btn-undo').click();
  await expect(page.locator('.piece')).toHaveCount(1);
});

test('nowa gra otwiera menu; Anuluj zostawia partię', async ({ page }) => {
  await cell(page, 3, 3).click();
  await expect(page.locator('.piece')).toHaveCount(1);
  await page.locator('#btn-new').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#menu-note')).toBeVisible();
  // przy 2 graczach nie ma wyboru koloru ani poziomu
  await expect(page.locator('#menu .only-solo').first()).toBeHidden();
  await page.locator('#btn-menu-cancel').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('.piece')).toHaveCount(1);

  await page.locator('#btn-new').click();
  await page.locator('#btn-start').click();
  await expect(page.locator('.piece')).toHaveCount(0);
  await expect(page.locator('#status')).toContainText('gracz pomarańczowy');
});

/** Otwiera menu i zaczyna grę z komputerem. */
async function startSolo(page, { color, level }) {
  await page.locator('#btn-new').click();
  await page.locator('#menu label', { hasText: '1 gracz' }).click();
  await expect(page.locator('#menu .only-solo').first()).toBeVisible();
  await page.locator('#menu label', { hasText: color }).click();
  await page.locator('#menu label', { hasText: new RegExp(`^\\s*${level}$`) }).click();
  await page.locator('#btn-start').click();
}

test('gra z komputerem: człowiek gra szarymi, komputer (pomarańczowy) zaczyna', async ({ page }) => {
  await startSolo(page, { color: 'Szary', level: 'Bardzo łatwy' });
  await expect(page.locator('#player-0 .who')).toHaveText('(komputer, bardzo łatwy)');
  await expect(page.locator('#player-1 .who')).toHaveText('(Ty)');
  // komputer stawia pierwszą mysz sam
  await expect(page.locator('#status')).toContainText('Twój ruch');
  await expect(page.locator('#player-0 [data-count="mouse"]')).toHaveText('7');
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('#board:not([data-busy])')).toBeVisible();

  // ruch człowieka na wolnym polu — komputer od razu odpowiada
  const occupied = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kocie-przepychanki:game')).state.board.flat().map((p) => !!p));
  const idx = occupied.findIndex((x) => !x);
  await page.locator('.cell').nth(idx).click();
  await expect(page.locator('#board:not([data-busy])')).toBeVisible();
  await expect(page.locator('#status')).toContainText('Twój ruch');
  // ruch komputera, ruch człowieka i odpowiedź komputera (licznik myszy nie wystarczy —
  // komputer mógł wypchnąć mysz człowieka z planszy z powrotem do zasobnika)
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('kocie-przepychanki:game')));
  expect((await saved()).history).toHaveLength(3);
  await expect(page.locator('#btn-undo')).toBeEnabled();

  // cofnięcie wraca do ruchu człowieka (cofa też odpowiedź komputera)
  await page.locator('#btn-undo').click();
  await expect(page.locator('#player-1 [data-count="mouse"]')).toHaveText('8');
  await expect(page.locator('#status')).toContainText('Twój ruch');
  expect((await saved()).history).toHaveLength(1);

  // ustawienia wracają po odświeżeniu
  await page.reload();
  await expect(page.locator('#player-0 .who')).toHaveText('(komputer, bardzo łatwy)');
  await expect(page.locator('#status')).toContainText('Twój ruch');
});

test('gra z komputerem: człowiek pomarańczowy zaczyna, komputer odpowiada', async ({ page }) => {
  await startSolo(page, { color: 'Pomarańczowy', level: 'Trudny' });
  await expect(page.locator('#player-1 .who')).toHaveText('(komputer, trudny)');
  await expect(page.locator('.piece')).toHaveCount(0);
  await cell(page, 2, 2).click(); // czeka też na ruch komputera
  await expect(page.locator('#status')).toContainText('Twój ruch');
  await expect(page.locator('#player-1 [data-count="mouse"]')).toHaveText('7');
  // pola komputera są wyłączone
  await expect(page.locator('#player-1 .pool-btn').first()).toBeDisabled();
});

test('komputer wygrywa, gdy ma trzy koty w zasięgu', async ({ page }) => {
  // komputer (szary) ma koty (0,0), (0,1) i kota w zasobniku; człowiek pomarańczowy już się ruszył
  const board = Array.from({ length: 6 }, () => Array(6).fill(null));
  board[0][0] = { id: 1, owner: 1, type: 'cat' };
  board[0][1] = { id: 2, owner: 1, type: 'cat' };
  board[5][5] = { id: 3, owner: 0, type: 'mouse' };
  const state = {
    board, pools: [{ mouse: 7, cat: 0 }, { mouse: 5, cat: 1 }],
    current: 1, phase: 'place', winner: null, winLine: null, nextId: 4,
  };
  await page.evaluate((s) => {
    localStorage.setItem('kocie-przepychanki:game', JSON.stringify({
      state: s, history: [], settings: { players: 1, human: 0, level: 3 },
    }));
  }, state);
  await page.reload();
  await expect(page.locator('#status')).toContainText('Wygrywa komputer');
  await expect(page.locator('.piece.win')).toHaveCount(3);
});

test('strona nie przewija się w bok', async ({ page }) => {
  const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(scroll).toBeLessThanOrEqual(width);
});

test('aplikacja do zainstalowania działa bez internetu', async ({ page, context }) => {
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await page.request.get(manifest);
  const json = await res.json();
  expect(json.name).toBe('Kocie przepychanki');
  expect(json.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // teraz stronę obsługuje service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Kocie przepychanki');
  await cell(page, 1, 1).click();
  await expect(page.locator('.piece')).toHaveCount(1);
  await context.setOffline(false);
});

test('8 pionków na planszy i rząd — wybór: rząd albo jeden pionek', async ({ page }) => {
  // pomarańczowy ma 7 myszy na planszy, w tym (0,0) i (0,1); ósma na (0,2) domknie rząd
  const board = Array.from({ length: 6 }, () => Array(6).fill(null));
  let id = 1;
  for (const [r, c] of [[0, 0], [0, 1], [2, 0], [2, 4], [4, 0], [4, 2], [4, 4]]) {
    board[r][c] = { id: id++, owner: 0, type: 'mouse' };
  }
  const state = {
    board, pools: [{ mouse: 1, cat: 0 }, { mouse: 8, cat: 0 }],
    current: 0, phase: 'place', winner: null, winLine: null, nextId: id,
  };
  await page.evaluate((s) => {
    localStorage.setItem('kocie-przepychanki:game', JSON.stringify({ state: s, history: [] }));
  }, state);
  await page.reload();

  const linesBtn = page.locator('#btn-lines');
  await expect(linesBtn).toBeHidden();
  await cell(page, 0, 2).click();
  await expect(page.locator('#status')).toContainText('pionki w rzędzie');
  await expect(linesBtn).toBeVisible();
  await expect(page.locator('.cell.in-line')).toHaveCount(3);

  // wariant A: zamieniają się pionki z rzędu
  await linesBtn.click();
  await expect(page.locator('#board:not([data-busy])')).toBeVisible();
  await expect(page.locator('#player-0 [data-count="cat"]')).toHaveText('3');
  await expect(page.locator('#status')).toContainText('gracz szary');
  await expect(linesBtn).toBeHidden();

  // wariant B (po cofnięciu): zamienia się jeden pionek, rząd zostaje
  await page.locator('#btn-undo').click();
  await expect(linesBtn).toBeVisible();
  await cell(page, 4, 4).click();
  await expect(page.locator('#player-0 [data-count="cat"]')).toHaveText('1');
  await expect(page.locator('.piece')).toHaveCount(7);
  await expect(linesBtn).toBeHidden();
});

test('rząd 4 pionków — gracz wskazuje trójkę, czwarty pionek zostaje', async ({ page }) => {
  // pomarańczowy: mysz (1,0) i koty (1,1), (1,3); mysz na (1,2) domknie rząd 4 (kotów nie rusza)
  const board = Array.from({ length: 6 }, () => Array(6).fill(null));
  board[1][0] = { id: 1, owner: 0, type: 'mouse' };
  board[1][1] = { id: 2, owner: 0, type: 'cat' };
  board[1][3] = { id: 3, owner: 0, type: 'cat' };
  const state = {
    board, pools: [{ mouse: 5, cat: 0 }, { mouse: 8, cat: 0 }],
    current: 0, phase: 'place', winner: null, winLine: null, nextId: 4,
  };
  await page.evaluate((s) => {
    localStorage.setItem('kocie-przepychanki:game', JSON.stringify({ state: s, history: [] }));
  }, state);
  await page.reload();

  await cell(page, 1, 2).click();
  await expect(page.locator('#status')).toContainText('więcej niż 3 pionki w rzędzie');
  await expect(page.locator('.cell.in-line')).toHaveCount(4);
  await expect(page.locator('.piece')).toHaveCount(4);

  await cell(page, 1, 1).click(); // trójka (1,0)–(1,2)
  await expect(page.locator('#player-0 [data-count="cat"]')).toHaveText('3');
  await expect(page.locator('.piece')).toHaveCount(1);
  await expect(pieceAt(page, 1, 3)).toHaveClass(/p0/);
  await expect(page.locator('#status')).toContainText('gracz szary');
});

test('ikona udostępniania: systemowe okno ze stałym adresem, a bez niego — schowek', async ({ page, context }) => {
  const btn = page.locator('.share-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-label', 'Udostępnij Kocie przepychanki');
  const box = await btn.boundingBox();
  expect(box.width).toBeLessThanOrEqual(32);

  await page.evaluate(() => {
    navigator.share = (data) => { window.__shared = data; return Promise.resolve(); };
  });
  await btn.click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.url).toBe('https://zbludzakowe-zabawy.github.io/Kocie-przepychanki/');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => { delete navigator.share; Navigator.prototype.share = undefined; });
  await btn.click();
  await expect(page.locator('#toast')).toContainText('Skopiowano link');
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('https://zbludzakowe-zabawy.github.io/Kocie-przepychanki/');
});
