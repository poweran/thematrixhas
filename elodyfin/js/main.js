import { loadGame, resetGame, gameData } from './state.js';
import { initAudio, startSequencer, stopSequencer, setBoost, getCurrentPhase, ac } from './audio.js';
import { initVisuals, animate } from './visuals.js';
import { getRandomVerse } from './words.js';

// --- INIT ---
loadGame();

// Bind UI Listeners
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const ui = document.getElementById('ui');
const hudTop = document.getElementById('hudTop');
const hudBottom = document.getElementById('hudBottom');
const phaseText = document.getElementById('phaseText');
const chordText = document.getElementById('chordText');
const progressBar = document.getElementById('progressBar');
const cycleVal = document.getElementById('cycleVal');
const keyVal = document.getElementById('keyVal');
const energyVal = document.getElementById('energyVal');
const flashOverlay = document.getElementById('flashOverlay');

if (startBtn && cycleVal) {
    if (gameData.cycle > 1) {
        startBtn.innerText = "RESUME CYCLE " + gameData.cycle;
        cycleVal.innerText = gameData.cycle;
    }
} else if (startBtn) {
    if (gameData.cycle > 1) {
        startBtn.innerText = "RESUME CYCLE " + gameData.cycle;
    }
}

startBtn.addEventListener('click', () => {
    ui.style.opacity = 0;
    setTimeout(() => ui.style.display = 'none', 800);

    if (hudTop) hudTop.style.opacity = 1;
    if (hudBottom) hudBottom.style.opacity = 1;

    initVisuals();
    initAudio(); // Initialize audio context
    startSequencer();

    animate();
});

window.addEventListener('ns-phase', (e) => {
    if (phaseText) phaseText.innerText = e.detail.name + " " + gameData.cycle;
    // Also update cycle val in case it changed
    if (cycleVal) cycleVal.innerText = gameData.cycle;
});

window.addEventListener('ns-chord', (e) => {
    if (chordText) chordText.innerText = e.detail.name;
});

window.addEventListener('ns-ui-update', (e) => {
    // High frequency updates
    if (progressBar) progressBar.style.width = (e.detail.progress * 100) + "%";
    if (keyVal) keyVal.innerText = e.detail.key;
});
