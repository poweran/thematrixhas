import { store } from './modules/store.js';
import { ui } from './modules/ui.js';
import { events, setupWindowExports } from './modules/events.js';
import { auth } from './modules/auth.js';
import { sync } from './modules/sync.js';

// Initialize
store.loadConfig();
store.loadState();
auth.init();
sync.init();
ui.init();
events.init();
events.ensureActiveColumn();
ui.render();
ui.switchTab('workout');

// Expose legacy globals for HTML onclick compatibility
setupWindowExports();
