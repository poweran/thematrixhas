export const gameData = {
    score: 0,
    cycle: 1,
    rootNoteIndex: 0
};

const STORAGE_KEY = 'neon_symphony_turbo_v2';

export function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('ns-saved'));
}

export function loadGame() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(gameData, parsed);
        } catch (e) { console.error("Save corrupted", e); }
    }
    return gameData;
}

export function resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    gameData.score = 0;
    gameData.cycle = 1;
    gameData.rootNoteIndex = 0;
    // Dispatch event for UI or Reload
    window.dispatchEvent(new CustomEvent('ns-reset'));
}
