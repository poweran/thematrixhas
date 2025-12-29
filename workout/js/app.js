import { store } from './modules/store.js';
import { ui } from './modules/ui.js';
import { events, setupWindowExports } from './modules/events.js';
import { auth } from './modules/auth.js';
import { sync } from './modules/sync.js';

// Initialize
store.loadConfig();
store.loadState();
store.loadStats();
auth.init();
sync.init();
ui.init();
events.init();
events.ensureActiveColumn();
store.subscribe((source) => {
    if (source === 'external') {
        ui.render();
    }
    if (source === 'external_stats') {
        if (document.getElementById('view-analytics').style.display !== 'none') {
            ui.renderHighLevelAnalytics();
        }
    }
});
ui.render();
ui.switchTab('workout');

// Expose legacy globals for HTML onclick compatibility
setupWindowExports();
