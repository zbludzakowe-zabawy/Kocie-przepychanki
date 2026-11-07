import test from 'node:test';
import assert from 'node:assert/strict';
import { installMode, isIos, watchForUpdates } from '../../src/pwa.js';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15';

const base = { standalone: false, dismissed: false, hasPrompt: false, userAgent: ANDROID, maxTouchPoints: 5 };

test('isIos rozpoznaje iPhone i iPad udający Maca', () => {
  assert.equal(isIos(IPHONE, 5), true);
  assert.equal(isIos(MAC, 5), true);
  assert.equal(isIos(MAC, 0), false);
  assert.equal(isIos(ANDROID, 5), false);
});

test('installMode: okno instalacji, podpowiedź iOS albo nic', () => {
  assert.equal(installMode({ ...base, hasPrompt: true }), 'prompt');
  assert.equal(installMode(base), 'none');
  assert.equal(installMode({ ...base, userAgent: IPHONE }), 'ios');
  assert.equal(installMode({ ...base, userAgent: IPHONE_CHROME }), 'none');
  assert.equal(installMode({ ...base, hasPrompt: true, standalone: true }), 'none');
  assert.equal(installMode({ ...base, hasPrompt: true, dismissed: true }), 'none');
});

function fakeWorker() {
  const w = new EventTarget();
  w.state = 'installing';
  w.postMessage = () => {};
  return w;
}

test('watchForUpdates zgłasza tylko prawdziwą aktualizację', () => {
  const reg = new EventTarget();
  reg.waiting = null;
  reg.installing = null;
  const seen = [];
  let controlled = true;
  watchForUpdates(reg, () => controlled, (w) => seen.push(w));
  const w = fakeWorker();
  reg.installing = w;
  reg.dispatchEvent(new Event('updatefound'));
  w.state = 'installed';
  w.dispatchEvent(new Event('statechange'));
  assert.deepEqual(seen, [w]);

  // pierwsza instalacja (brak kontrolera) — bez komunikatu
  controlled = false;
  const w2 = fakeWorker();
  reg.installing = w2;
  reg.dispatchEvent(new Event('updatefound'));
  w2.state = 'installed';
  w2.dispatchEvent(new Event('statechange'));
  assert.equal(seen.length, 1);
});

test('watchForUpdates od razu zgłasza czekającego workera', () => {
  const reg = new EventTarget();
  reg.waiting = fakeWorker();
  reg.installing = null;
  const seen = [];
  watchForUpdates(reg, () => true, (w) => seen.push(w));
  assert.deepEqual(seen, [reg.waiting]);
});
