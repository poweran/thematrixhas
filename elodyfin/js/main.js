import { loadGame, resetGame, gameData } from './state.js';
import { initAudio, startSequencer, stopSequencer, setBoost, getCurrentPhase } from './audio.js';
import { initVisuals, animate } from './visuals.js';
import { getRandomWord } from './words.js';

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

if (gameData.cycle > 1) {
    startBtn.innerText = "RESUME CYCLE " + gameData.cycle;
    cycleVal.innerText = gameData.cycle;
}

startBtn.addEventListener('click', () => {
    ui.style.opacity = 0;
    setTimeout(() => ui.style.display = 'none', 800);

    hudTop.style.opacity = 1;
    hudBottom.style.opacity = 1;

    initVisuals();
    initAudio(); // Initialize audio context
    startSequencer();

    animate();
});

resetBtn.addEventListener('click', () => {
    resetGame();
    location.reload();
});

// Boost Interaction
const handleBoost = (active) => { setBoost(active); };
document.addEventListener('mousedown', () => handleBoost(true));
document.addEventListener('mouseup', () => handleBoost(false));
document.addEventListener('touchstart', (e) => { e.preventDefault(); handleBoost(true); }, { passive: false });
document.addEventListener('touchend', (e) => { e.preventDefault(); handleBoost(false); });

// --- EVENT LISTENERS (Architecture glue) ---

window.addEventListener('ns-saved', () => {
    const icon = document.getElementById('saveIcon');
    if (icon) {
        icon.style.opacity = 1;
        setTimeout(() => icon.style.opacity = 0, 800);
    }
});

window.addEventListener('ns-phase', (e) => {
    phaseText.innerText = e.detail.name + " " + gameData.cycle;
    // Also update cycle val in case it changed
    cycleVal.innerText = gameData.cycle;
});

window.addEventListener('ns-chord', (e) => {
    chordText.innerText = e.detail.name;

    // Emotional Word Trigger
    // Check phase via gameData or just access the text from the UI (hacky but works)
    // Better: Helper function
    const currentPhaseName = phaseText.innerText.split(" ")[0]; // "INTRO", "BUILD" etc.

    if (currentPhaseName === "BUILD" || currentPhaseName === "CLIMAX") {
        // Higher chance in CLIMAX
        const chance = currentPhaseName === "CLIMAX" ? 0.7 : 0.3;
        if (Math.random() < chance) {
            triggerEmotionalWord();
        }
    }
});

function triggerEmotionalWord() {
    const container = document.getElementById('emotional-word-overlay');
    if (!container) return;

    const word = getRandomWord();
    const el = document.createElement('div');
    el.classList.add('emotional-word');
    el.innerText = word;

    // Random position offset
    const x = (Math.random() - 0.5) * 40; // +/- 20%
    const y = (Math.random() - 0.5) * 30;

    // We modify margin instead of transform to avoid conflict with animation
    el.style.marginLeft = `${x}%`;
    el.style.marginTop = `${y}%`;

    container.innerHTML = ''; // Clear previous
    container.appendChild(el);

    // Cleanup after animation
    setTimeout(() => {
        if (container.contains(el)) container.removeChild(el);
    }, 4000);
}

window.addEventListener('ns-ui-update', (e) => {
    // High frequency updates
    progressBar.style.width = (e.detail.progress * 100) + "%";
    keyVal.innerText = e.detail.key; // Redundant but safe
});

window.addEventListener('ns-flash', () => {
    flashOverlay.style.opacity = 0.5;
    setTimeout(() => flashOverlay.style.opacity = 0, 100);
});

// Update Energy display loop (since it's purely visual/state based)
setInterval(() => {
    // Energy is roughly based on speed or boost.
    // Since main doesn't have direct access to uniforms, we can approximate it or leave it to visuals.
    // However, visuals.js is concerned with Canvas.
    // I can read the text from visuals or just set it here based on 'isBoosting' state?
    // Let's use a simple approximation here or expose energy from visuals.
    // Actually, visuals.js sets the uniforms. 
    // In strict modules, `visuals.js` should update the DOM element for Energy?
    // OR `visuals.js` dispatches 'ns-energy' event? 
    // I'll leave the energy update inside `visuals.js` animate loop? 
    // NO, `visuals.js` does NOT touch DOM in my extraction. 
    // So I need a way to get energy.
    // I'll update `energyVal` based on simple logic here:
    // 50% base, +10% per cycle, 100% if boost.

    let base = 50 + (gameData.cycle * 10);
    // Since I can't easily read `uni.uSpeed` without exposing it, I'll approximate.
}, 1000);

// Actually, I'll add the energy update logic to the `ns-ui-update` event if audio knows it? 
// No, visuals knows the speed.
// I will just add `energyVal` update to `visuals.js` animate loop? 
// Ideally visuals shouldn't touch DOM. 
// I will dispatch 'ns-visual-update' from visuals? No too spammy.
// I will just pass the DOM element to initVisuals? 
// Or just query selector it inside visuals (pragmatic).
// I will query selector it inside visuals.js for now.
