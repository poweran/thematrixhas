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

    compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 12;

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
function generateMelody() {
    const safeNotes = [0, 2, 4, 7, 1];
    motif = [];
    for (let i = 0; i < 4; i++) {
        motif.push(safeNotes[Math.floor(Math.random() * safeNotes.length)]);
    }
}

function updateProgression() {
    const currentP = PHASES[currentPhaseIdx];

    if (measure >= phaseStartMeasure + currentP.bars) {
        currentPhaseIdx++;
        if (currentPhaseIdx >= PHASES.length) {
            currentPhaseIdx = 0;
            gameData.cycle++;
            gameData.rootNoteIndex = (gameData.rootNoteIndex + 2) % 12;
            saveGame();
            generateMelody();
        }
        phaseStartMeasure = measure;

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
        saveGame();
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

    if (p.kick && s % 4 === 0) playKick(t, 1.0);

    if (p.bass) {
        const bassFreq = getScaleNote(rootDeg, 1);
        if (s % 4 === 2) playBass(t, bassFreq);
        if (isBoosting && s % 4 !== 0) playBass(t, bassFreq);
    }

    if (p.arp && s % 2 === 0) {
        const motifNote = motif[(s / 2) % motif.length];
        const note = getScaleNote(rootDeg + motifNote, 3);
        const pan = (s % 4 === 0) ? -0.5 : 0.5;
        playPluck(t, note, pan);
    }

    if (p.pad && s === 0 && measure % 2 === 0) {
        const chordFreqs = getChordFreqs(rootDeg, 3);
        playChordStab(t, chordFreqs);
    }
}

function schedule() {
    if (!isPlaying) return;
    const tempo = 138 + (gameData.cycle * 2);
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
            if (measure % 4 === 0) saveGame();
        }
    }
    setTimeout(schedule, 25);

    // Also update filter ramp
    updateAudioParams();
}
