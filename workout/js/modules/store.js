import { CONFIG_KEY, STORAGE_KEY_BASE, LEGACY_STORAGE_KEY, STATS_KEY } from './constants.js';
import { getWeekId } from './utils.js';

export const store = {
    config: { days: 2, sets: 4 },
    state: {},
    weeksCache: {},
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

    loadStats() {
        // No-op
    },

    setStats() {
        // No-op
    },

    getStats() {
        const stats = [];
        console.log('Store: Calculating stats from cache. Weeks:', Object.keys(this.weeksCache));

        // Iterate all weeks
        Object.entries(this.weeksCache).forEach(([weekId, weekData]) => {
            if (!weekData) return;

            // Expected format: "2024-W52"
            const [yearStr, weekStr] = weekId.split('-W');
            const year = parseInt(yearStr);
            const week = parseInt(weekStr);

            if (isNaN(year) || isNaN(week)) {
                console.warn('Store: Invalid weekId format', weekId);
                return;
            }

            // Get date of Monday of that week (ISO 8601)
            const simple = new Date(year, 0, 1 + (week - 1) * 7);
            const dayOfWeek = simple.getDay();
            const ISOweekStart = simple;
            if (dayOfWeek <= 4)
                ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            else
                ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

            // Iterate cells
            Object.entries(weekData).forEach(([k, cell]) => {
                if (cell && (cell.done || (cell.reps !== "" && cell.reps > 0))) {
                    // key format: "Muscle_DayIndex_SetIndex" -> "Chest_0_1"
                    // Or new format if Muscle contains underscores? Assuming Muscle has no underscores or taking part 0
                    const parts = k.split('_');
                    if (parts.length >= 3) {
                        // Muscle is parts[0]
                        // DayIndex is parts[1]
                        const dayIndex = parseInt(parts[1]);

                        // Calculate specific date
                        const d = new Date(ISOweekStart);
                        d.setDate(d.getDate() + dayIndex);

                        const repsVal = parseFloat(cell.reps) || 0;
                        // console.log(`Stats: Found entry ${k}: ${repsVal} min on ${d.toISOString()}`);

                        stats.push({
                            key: k,
                            reps: repsVal,
                            ts: d.getTime()
                        });
                    }
                }
            });
        });

        console.log('Store: Stats calculated. Total entries:', stats.length);
        // Sort by time
        return stats.sort((a, b) => a.ts - b.ts);
    },

    // Helpers
    changeWeek(delta) {
        this.currentWeekOffset += delta;
        this.loadState();
    }
};
