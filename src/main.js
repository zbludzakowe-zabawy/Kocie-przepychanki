import './style.css';
import { initGame } from './ui.js';
import { initPwa } from './pwa.js';
import { loadPref, savePref } from './storage.js';

initGame();
initPwa({ loadPref, savePref });
