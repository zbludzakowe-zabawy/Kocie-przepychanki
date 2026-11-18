import './style.css';
import { initGame } from './ui.js';
import { initPwa } from './pwa.js';
import { initShare } from './share.js';
import { loadPref, savePref } from './storage.js';

initGame();
initPwa({ loadPref, savePref });
initShare();
