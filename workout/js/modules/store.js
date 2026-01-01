import { CONFIG_KEY, STORAGE_KEY_BASE, LEGACY_STORAGE_KEY, STATS_KEY, ALPHABET } from './constants.js';
import { getWeekId } from './utils.js';

export const store = {
    config: { days: 2, sets: 4 },
    state: {},
    weeksCache: {},
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

        // Update Cache
        this.weeksCache[weekId] = { ...this.state };

        const key = `${STORAGE_KEY_BASE}_${weekId}`;
        localStorage.setItem(key, JSON.stringify(this.state));

        // Persist cache locally for offline analytics (optional, but good for speed)
        // For now, let's rely on standard storage keys we already use. 
        // We technically only stash the CURRENT week in localStorage deeply in 'state'.
        // To allow full offline analytics, we probably should treat localStorage as a cache for other weeks too.
        // But let's stick to the current pattern: Sync module populates weeksCache from cloud.

        if (this.currentWeekOffset === 0) {
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(this.state));
        }

        if (!skipNotify) {
            this.notify('local');
            this.notify('external_stats'); // Trigger re-calc of stats locally immediately
        }
    },

    // Stats Management (Derived)
    updateWeeksCache(weekId, data) {
        this.weeksCache[weekId] = data;
        this.notify('external_stats');
    },

    addStat(key, reps) {
        // No-op for legacy calls. We rely on saveData() updating the state.
        // The analytics will re-derive from state.
        return [];
    },



    getStats() {
        const stats = [];

        // Iterate all weeks
        Object.entries(this.weeksCache).forEach(([weekId, weekData]) => {
            if (!weekData) return;

            // Format is "YYYY-MM-DD" (Monday of the week)
            // e.g. "2024-12-30"
            const partsDate = weekId.split('-');
            if (partsDate.length !== 3) {
                return;
            }

            const year = parseInt(partsDate[0]);
            const month = parseInt(partsDate[1]) - 1; // JS months are 0-indexed
            const day = parseInt(partsDate[2]);

            if (isNaN(year) || isNaN(month) || isNaN(day)) return;

            const isoWeekStart = new Date(year, month, day);

            // Iterate cells
            Object.entries(weekData).forEach(([k, cell]) => {
                if (cell && (cell.done || (cell.reps !== "" && cell.reps > 0))) {
                    // key format: "Muscle_DayIndex_SetIndex" -> "Chest_A_1"
                    const parts = k.split('_');
                    if (parts.length >= 3) {
                        const dayLetter = parts[1];
                        let dayIndex = parseInt(dayLetter); // Try legacy numeric first

                        if (isNaN(dayIndex)) {
                            dayIndex = ALPHABET.indexOf(dayLetter);
                        }

                        if (dayIndex === -1 || isNaN(dayIndex)) {
                            return;
                        }

                        // Calculate specific date
                        const d = new Date(isoWeekStart);
                        d.setDate(d.getDate() + dayIndex);

                        const repsVal = parseFloat(cell.reps) || 0;

                        stats.push({
                            key: k,
                            reps: repsVal,
                            ts: d.getTime()
                        });
                    }
                }
            });
        });
        // Sort by time
        return stats.sort((a, b) => a.ts - b.ts);
    },

    // Helpers
    changeWeek(delta) {
        this.currentWeekOffset += delta;
        this.loadState();
    }
};
