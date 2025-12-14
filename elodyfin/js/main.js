import { loadGame, resetGame, gameData } from './state.js';
import { initAudio, startSequencer, stopSequencer, setBoost, getCurrentPhase, ac } from './audio.js';
import { initVisuals, animate } from './visuals.js';
import { getRandomMode } from './words.js';

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
    // Use getCurrentPhase for reliability
    const currentPhase = getCurrentPhase();
    if (currentPhase && (currentPhase.name === "BUILD" || currentPhase.name === "CLIMAX")) {
        // ... handled in ns-beat now
    }
});

// Queue for rhythmic delivery
let verseQueue = [];
let beatQueue = []; // Timestamps of beats

window.addEventListener('ns-beat-scheduled', (e) => {
    beatQueue.push(e.detail.time);
});

// Precision Sync Loop
function syncLoop() {
    requestAnimationFrame(syncLoop);
    if (!ac) return;

    const now = ac.currentTime;
    // Tolerance window (e.g. if we missed it by a frame, still play, but don't play too far in future)

    while (beatQueue.length > 0) {
        if (beatQueue[0] <= now) {
            beatQueue.shift();
            handleOnBeat();
        } else {
            break; // Next beat is in future
        }
    }
}
syncLoop();

// Queue for content
let verseData = [];      // Current verse (array of lines of syllables)
let pendingVisualConfig = null; // Store config for delayed application
let currentLineIdx = 0;
let currentSylIdx = 0;
let currentLineEl = null;

// Beat Trigger Logic
function handleOnBeat() {
    const currentPhase = getCurrentPhase();
    if (!currentPhase) return;

    // A. Check if we have active content
    if (!verseData || verseData.length === 0) {
        // CONTINUOUS FLOW: Auto-refill immediately in active phases
        // No probability gaps. If we are in BUILD/CLIMAX, we flow.
        if (currentPhase.name === "BUILD" || currentPhase.name === "CLIMAX") {
            const mode = getRandomMode(gameData.cycle);
            verseData = mode.verses[0]; // Get the 4-line verse

            // STORE CONFIG (Delayed Apply: "Execute Code")
            pendingVisualConfig = mode.config;

            currentLineIdx = 0;
            currentSylIdx = 0;
        } else {
            return; // Silence in INTRO/RELEASE
        }
    }

    // B. Trigger Next Syllable
    triggerNextSyllable();
}

function triggerNextSyllable() {
    const container = document.getElementById('emotional-word-overlay');
    if (!container) return;

    // 1. Get current line data
    const lineData = verseData[currentLineIdx]; // ["<span..>Syl</span>", "la", "ble"]

    // 2. Start new line element if needed
    if (currentSylIdx === 0) {

        // NEW: Check if we need a new VERSE CONTAINER (Start of Verse)
        if (currentLineIdx === 0) {
            // Create a wrapper for the whole verse
            const verseBlock = document.createElement('div');
            verseBlock.classList.add('verse-block');
            verseBlock.style.marginBottom = '20px'; // Spacing between formulas

            // Append to overlay
            container.appendChild(verseBlock);

            // LIMIT TO 2 VERSES (Current + Previous)
            // "Old formulas disappeared immediately"
            while (container.children.length > 2) {
                container.removeChild(container.firstChild);
            }

            // Store reference to current verse block
            // We can attach it to the container or use a global, but let's use lastChild
        }

        const currentVerseBlock = container.lastElementChild;

        // Create new line container attached to Verse Block
        currentLineEl = document.createElement('div');
        currentLineEl.classList.add('emotional-word');
        currentVerseBlock.appendChild(currentLineEl);
    }

    // Approximating syllables by spaces + 1? Or just random high density for effect
    // Math Generation Metric
    // const entropy = (Math.random() * 10).toFixed(4); // Removed by request

    // 3. Append syllable
    const syl = lineData[currentSylIdx];
    const sylSpan = document.createElement('span');
    sylSpan.classList.add('emotional-syllable'); // Trigger pop animation
    sylSpan.innerHTML = syl; // Clean math symbols only
    currentLineEl.appendChild(sylSpan);

    // 4. Advance Pointers
    currentSylIdx++;

    // 5. Check End of Line
    if (currentSylIdx >= lineData.length) {
        // Line Complete
        // Add Metric at end of line? Or just let it stick.
        // Add class to trigger eventual fade out? 
        // No, let's keep them solid until the whole block is removed.
        // Or keep the fade out for lines is okay, as long as the whole block vanishes later.
        currentLineEl.classList.add('line-finished');

        // Prepare for next line
        currentLineIdx++;
        currentSylIdx = 0;
        currentLineEl = null; // Reset current element ref

        // Check End of Verse
        if (currentLineIdx >= verseData.length) {
            verseData = []; // Clear verse

            // DELAYED VISUAL CONFIG: Execute now!
            if (pendingVisualConfig) {
                // Flash effect to signify "Code Executed"
                window.dispatchEvent(new CustomEvent('ns-flash'));
                window.dispatchEvent(new CustomEvent('ns-visual-config', { detail: pendingVisualConfig }));
                pendingVisualConfig = null;
            }
        }
    }
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
