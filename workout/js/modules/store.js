import { CONFIG_KEY, STORAGE_KEY_BASE, LEGACY_STORAGE_KEY, STATS_KEY } from './constants.js';
import { getWeekId } from './utils.js';

export const store = {
    config: { days: 2, sets: 4 },
    state: {},
    statsState: [],
    currentWeekOffset: 0,
    currentWeekOffset: 0,
    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify(source = 'local') {
        this.listeners.forEach(fn => fn(source));
    },

    setState(newState) {
        this.state = newState || {};
        this.saveData(true); // true = skip cloud sync to prevent loops if coming from cloud
        this.notify('external');
    },

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

    saveData(skipNotify = false) {
        const weekId = getWeekId(this.currentWeekOffset);
        const key = `${STORAGE_KEY_BASE}_${weekId}`;
        localStorage.setItem(key, JSON.stringify(this.state));

        // Sync to legacy key ONLY if it's the current week
        if (this.currentWeekOffset === 0) {
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(this.state));
        }

        if (!skipNotify) {
            this.notify('local');
        }
    },

    // Stats Management
    loadStats() {
        const stats = localStorage.getItem(STATS_KEY);
        this.statsState = stats ? JSON.parse(stats) : [];
        return this.statsState;
    },

    setStats(newStats) {
        this.statsState = newStats || [];
        localStorage.setItem(STATS_KEY, JSON.stringify(this.statsState));
        this.notify('external_stats');
    },

    addStat(key, reps) {
        this.statsState.push({ key, reps, ts: Date.now() });
        localStorage.setItem(STATS_KEY, JSON.stringify(this.statsState));
        this.notify('local_stats');
        return this.statsState;
    },

    getStats() {
        return this.statsState;
    },

    // Helpers
    changeWeek(delta) {
        this.currentWeekOffset += delta;
        this.loadState();
    }
};
