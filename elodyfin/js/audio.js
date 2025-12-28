import { gameData, saveGame } from './state.js';
import { NOTES, PROGRESSION, getScaleNote, getChordFreqs } from './audio-constants.js';

export let ac;
export let analyser;
export let masterFilter;
let master, compressor, reverbNode;

// Sequencer State
let nextNoteTime = 0;
let current16th = 0;
let measure = 0;
let currentChordIdx = 0;
let currentPhaseIdx = 0;
let phaseStartMeasure = 0;
let isPlaying = false;
let isBoosting = false;
let motif = [0, 1, 2, 0];

export const PHASES = [
    { name: "INTRO", bars: 4, kick: false, bass: false, arp: true, pad: true, filterTarget: 400 },
    { name: "BUILD", bars: 8, kick: true, bass: true, arp: true, pad: true, filterTarget: 1000 },
    { name: "CLIMAX", bars: 16, kick: true, bass: true, arp: true, pad: true, filterTarget: 10000 },
    { name: "RELEASE", bars: 4, kick: false, bass: true, arp: false, pad: true, filterTarget: 300 }
];

export const PALETTES = {
    "INTRO": { c1: 0x001133, c2: 0x0044ff },
    "BUILD": { c1: 0x00ffff, c2: 0xff00ff },
    "CLIMAX": { c1: 0xffaa00, c2: 0xff0000 },
    "RELEASE": { c1: 0x00ff00, c2: 0x004400 }
};

export function setBoost(val) { isBoosting = val; }
export function getBoost() { return isBoosting; }
export function getCurrentPhase() { return PHASES[currentPhaseIdx]; }

// --- INIT ---
export function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0.5;

    masterFilter = ac.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 200;
    masterFilter.Q.value = 1;
    // Fix channel count glitch
    masterFilter.channelCount = 2;
    masterFilter.channelCountMode = 'explicit';

    compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 12;
    compressor.channelCount = 2;
    compressor.channelCountMode = 'explicit';

    const len = ac.sampleRate * 3;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let i = 0; i < len; i++) {
        let d = Math.pow(1 - i / len, 2);
        buf.getChannelData(0)[i] = (Math.random() * 2 - 1) * d;
        buf.getChannelData(1)[i] = (Math.random() * 2 - 1) * d;
    }
    reverbNode = ac.createConvolver();
    reverbNode.buffer = buf;
    const revMix = ac.createGain();
    revMix.gain.value = 0.3;

    master.connect(masterFilter);
    masterFilter.connect(compressor);
    compressor.connect(ac.destination);
    masterFilter.connect(reverbNode);
    reverbNode.connect(revMix);
    revMix.connect(compressor);

    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    compressor.connect(analyser);

    // Resume if needed
    if (ac.state === 'suspended') ac.resume();
}

export function startSequencer() {
    if (!ac) initAudio();
    isPlaying = true;
    nextNoteTime = ac.currentTime + 0.1;
    if (measure === 0) {
        generateMelody();
        updateProgression(); // Initial UI update
    }
    schedule();
}

export function stopSequencer() {
    isPlaying = false;
}

// --- SYNTHS ---
function playKick(t, vel = 1.0) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(1.0 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.3);
}

function playBass(t, freq) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(100, t + 0.2);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(f); f.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.2);
}

function playPluck(t, freq, panVal = 0) {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);

    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    const pan = ac.createStereoPanner();
    pan.pan.value = panVal;

    osc.connect(g); g.connect(pan); pan.connect(masterFilter);
    osc.start(t); osc.stop(t + 0.3);
}

function playChordStab(t, freqs) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    freqs.forEach((f, i) => {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = (i % 2 === 0 ? 1 : -1) * 5;
        osc.connect(g);
        osc.start(t); osc.stop(t + 1.0);
    });

    g.connect(masterFilter);
}

function playNoiseRise(t, dur) {
    const bSize = ac.sampleRate * dur;
    const b = ac.createBuffer(1, bSize, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = b;

    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(10000, t + dur);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.linearRampToValueAtTime(0, t + dur);

    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
}

// --- LOGIC ---


// --- ALGORITHMIC HELPERS ---
function getEuclideanPattern(steps, pulses) {
    const pattern = new Array(steps).fill(0);
    const bucket = steps;
    let current = 0;
    for (let i = 0; i < pulses; i++) {
        current += bucket;
        // Evenly distribute pulses
        const idx = Math.floor((i * steps) / pulses);
        pattern[idx] = 1;
    }
    return pattern;
}

function generateRandomPattern(steps, density) {
    const p = [];
    for (let i = 0; i < steps; i++) {
        p.push(Math.random() < density ? 1 : 0);
    }
    return p;
}

// Evolution State
let bassPattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // Default 4/4
let arpPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]; // Default 8ths

// Simple "Designed" Evolution
function generateMelody() {
    const cycle = gameData.cycle;
    // Length grows: 4 -> 8 -> 16
    let targetLen = 4;
    if (cycle >= 3) targetLen = 8;
    if (cycle >= 6) targetLen = 16;

    if (motif.length !== targetLen) {
        motif = new Array(targetLen).fill(0);
    }

    // Dynamic Motif Generation
    // Each time this is called (per phase/cycle), we mutate
    for (let i = 0; i < motif.length; i++) {
        // Seed based on position + cycle + randomness
        const seed = (i * 3) + cycle + Math.floor(Math.random() * 5);
        motif[i] = seed % 7;

        // Occasional large jumps
        if (Math.random() > 0.8) motif[i] += 4;
        motif[i] = motif[i] % 12; // Keep within octave-ish range
    }
    console.log(`[Audio] Cycle ${cycle}: Melody Regenerated`);

    // Also regenerate Rhythms
    generateRhythms();
}

function generateRhythms() {
    // BASS: 16 steps. Pulses depend on intensity (Phase/Cycle)
    // Intro: Sparse (3-4 pulses), Build: Med (5-8), Climax: High (8-12)
    const p = PHASES[currentPhaseIdx];
    let pulses = 4;
    if (p.name === "BUILD") pulses = 6 + Math.floor(Math.random() * 3);
    if (p.name === "CLIMAX") pulses = 8 + Math.floor(Math.random() * 5);

    // Shift pulses slightly based on cycle
    pulses += (gameData.cycle % 3);
    pulses = Math.min(pulses, 16);

    bassPattern = getEuclideanPattern(16, pulses);

    // ARP: Complex patterns
    // Random density
    const arpDensity = 0.3 + (gameData.cycle * 0.05);
    arpPattern = generateRandomPattern(16, Math.min(arpDensity, 0.9));

    console.log(`[Audio] Rhythms Regenerated. Bass Pulses: ${pulses}`);
}


function updateProgression() {
    const currentP = PHASES[currentPhaseIdx];

    if (measure >= phaseStartMeasure + currentP.bars) {
        currentPhaseIdx++;
        if (currentPhaseIdx >= PHASES.length) {
            currentPhaseIdx = 0;
            gameData.cycle++;
            gameData.rootNoteIndex = (gameData.rootNoteIndex + 7) % 12; // Circle of fifths
            saveGame();
            gameData.rootNoteIndex = (gameData.rootNoteIndex + 7) % 12; // Twist
            saveGame();
        }
        phaseStartMeasure = measure;

        // REGENERATE MUSIC EVERY PHASE CHANGE
        // This keeps it fresh constantly
        generateMelody();

        // Dispatch Events
        window.dispatchEvent(new CustomEvent('ns-flash'));
        window.dispatchEvent(new CustomEvent('ns-phase', {
            detail: {
                name: PHASES[currentPhaseIdx].name
            }
        }));

        if (PHASES[currentPhaseIdx].name === "CLIMAX") {
            playNoiseRise(ac.currentTime, 2.0);
        }
    }

    const p = PHASES[currentPhaseIdx];

    // Dispatch UI updates
    window.dispatchEvent(new CustomEvent('ns-ui-update', {
        detail: {
            phase: p.name,
            progress: (measure - phaseStartMeasure) / p.bars,
            key: NOTES[gameData.rootNoteIndex] + " Minor"
        }
    }));
}

export function updateAudioParams() {
    if (!ac) return;
    const p = PHASES[currentPhaseIdx];
    if (isBoosting) {
        masterFilter.frequency.setTargetAtTime(20000, ac.currentTime, 0.1);
    } else {
        masterFilter.frequency.setTargetAtTime(p.filterTarget, ac.currentTime, 2.0);
    }
}


function processStep(s, t) {
    const p = PHASES[currentPhaseIdx];

    if (measure % 4 === 0 && s === 0) {
        currentChordIdx = (measure / 4) % PROGRESSION.length;
        window.dispatchEvent(new CustomEvent('ns-chord', { detail: { name: PROGRESSION[currentChordIdx].name } }));
    }

    const rootDeg = PROGRESSION[currentChordIdx].degree;

    if (s % 4 === 0) { // Still dispatch beat event for visuals (though text is disabled)
        window.dispatchEvent(new CustomEvent('ns-beat-scheduled', { detail: { time: t } }));
    }

    // --- DYNAMIC EVOLUTION LOGIC ---

    // KICK: Foundation (4-on-floor + variations)
    // Always play on beats 0, 4, 8, 12 in House/Techno usually, but let's mix it.
    let kickTrig = (s % 4 === 0);

    // Add off-beat kicks in higher energy states
    if (p.name === "CLIMAX" && gameData.cycle > 2) {
        if (s % 8 === 7) kickTrig = true; // fast double kick
    }

    if (p.kick && kickTrig) playKick(t, 1.0);

    // BASS: Euclidean Pattern
    if (p.bass) {
        // Pattern lookup
        let isHit = bassPattern[s];

        // Simple syncopation: always duck the kick if desired, OR lock to it.
        // Let's just play the pattern. 
        if (isHit || (isBoosting && s % 2 === 0)) {
            const bassFreq = getScaleNote(rootDeg, 1);
            playBass(t, bassFreq);
        }
    }

    // ARP: Dynamic Pattern + Melody
    if (p.arp) {
        // Use arpPattern
        if (arpPattern[s]) {
            // Pick note from melody or chord?
            // Combined: Arp walks through chord tones OR plays motif
            // Let's mix: Cycle through motif
            const motifIdx = (measure * 16 + s) % motif.length;
            const motifNote = motif[motifIdx];

            // Octave jumps
            let octave = 3;
            if (s % 3 === 0) octave = 4;

            const note = getScaleNote(rootDeg + motifNote, octave);

            // Panning movement
            const pan = Math.sin(t * 2) * 0.4;
            playPluck(t, note, pan);
        }
    }

    // PADS: Ambient Texture
    if (p.pad && s === 0 && measure % 2 === 0) {
        let extensions = 0;
        // Evolve harmony complexity
        if (gameData.cycle > 2) extensions = 1;
        if (gameData.cycle > 5) extensions = 2;

        // Random inversion
        const inversion = Math.floor(Math.random() * 3); // 0, 1, 2

        // Note: getChordFreqs might not support inversion arg, assume it just returns base. 
        // We can manually shift frequencies if needed, but let's stick to standard for now.
        const chordFreqs = getChordFreqs(rootDeg, 3, extensions);

        playChordStab(t, chordFreqs);
    }
}

function schedule() {
    if (!isPlaying) return;
    const tempo = 138 + (gameData.cycle * 1.5); // Slightly slower accel
    const secPer16th = 60 / tempo / 4;
    const lookahead = 0.1;

    while (nextNoteTime < ac.currentTime + lookahead) {
        processStep(current16th, nextNoteTime);
        nextNoteTime += secPer16th;
        current16th++;
        if (current16th === 16) {
            current16th = 0;
            measure++;
            updateProgression();
        }
    }
    setTimeout(schedule, 25);

    // Also update filter ramp
    updateAudioParams();
}
