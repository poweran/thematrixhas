import { CONFIG_KEY, STORAGE_KEY_BASE, LEGACY_STORAGE_KEY, STATS_KEY } from './constants.js';
import { getWeekId } from './utils.js';

export const store = {
    config: { days: 2, sets: 4 },
    state: {},
    currentWeekOffset: 0,

    // Config Management
    loadConfig() {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) {
            this.config = JSON.parse(stored);
        }
        return this.config;
    },

    saveConfig(newConfig) {
        this.config = newConfig;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    },

    // State Management
    loadState() {
        const weekId = getWeekId(this.currentWeekOffset);
        const key = `${STORAGE_KEY_BASE}_${weekId}`;
        const loaded = localStorage.getItem(key);

        if (loaded) {
            this.state = JSON.parse(loaded);
        } else {
            // Migration Logic
            if (this.currentWeekOffset === 0) {
                const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacy) {
                    console.log('Migrating legacy data to current week...');
                    this.state = JSON.parse(legacy);
                    this.saveData();
                } else {
                    this.state = {};
                }
            } else {
                this.state = {};
            }
        }
        return this.state;
    },

    saveData() {
        const weekId = getWeekId(this.currentWeekOffset);
        const key = `${STORAGE_KEY_BASE}_${weekId}`;
        localStorage.setItem(key, JSON.stringify(this.state));

        // Sync to legacy key ONLY if it's the current week
        if (this.currentWeekOffset === 0) {
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(this.state));
        }
    },

    // Stats Management
    addStat(key, reps) {
        const stats = JSON.parse(localStorage.getItem(STATS_KEY)) || [];
        stats.push({ key, reps, ts: Date.now() });
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        return stats;
    },

    getStats() {
        return JSON.parse(localStorage.getItem(STATS_KEY)) || [];
    },

    // Helpers
    changeWeek(delta) {
        this.currentWeekOffset += delta;
        this.loadState();
    }
};
