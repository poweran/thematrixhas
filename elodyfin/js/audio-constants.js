import { gameData } from './state.js';

export const BASE_FREQ = 46.25;
export const NOTES = ["F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "F"];
export const SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Minor

// Progression: i - VI - III - VII
export const PROGRESSION = [
    { degree: 0, name: "i" },
    { degree: 5, name: "VI" },
    { degree: 2, name: "III" },
    { degree: 6, name: "VII" }
];

// Color Palettes (Used by visuals, but defined with phases which are musical structures)
// Actually phases are more game logic/audio logic. I'll keep them here or in audio.js
// But PALETTES are needed for Visuals.
// I will move PALETTES to audio.js and export or keep in a shared constants file if needed.
// For now, let's keep basic notes utility here.

export function getFreq(noteIndex, octave) {
    const semitones = noteIndex + (octave * 12) + gameData.rootNoteIndex;
    return BASE_FREQ * Math.pow(2, semitones / 12);
}

export function getScaleNote(scaleDegree, octave) {
    const octaveShift = Math.floor(scaleDegree / 7);
    const indexInScale = Math.abs(scaleDegree % 7);
    const chromaticIndex = SCALE_INTERVALS[indexInScale];
    return getFreq(chromaticIndex, octave + octaveShift);
}

export function getChordFreqs(rootDegree, octave, extensions = 0) {
    const freqs = [
        getScaleNote(rootDegree, octave),
        getScaleNote(rootDegree + 2, octave),
        getScaleNote(rootDegree + 4, octave)
    ];
    // Add 7th (root + 6 scale steps)
    if (extensions >= 1) freqs.push(getScaleNote(rootDegree + 6, octave));
    // Add 9th (root + 8 scale steps -> root + 1 note in next octave)
    if (extensions >= 2) freqs.push(getScaleNote(rootDegree + 8, octave));

    return freqs;
}
