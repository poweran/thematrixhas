import { store } from './store.js';
import { ui } from './ui.js';
import { audio, zapper } from './audio.js';
import { keyOf, getTrainings, getSets } from './utils.js';
import { muscles, exerciseConfig } from '../data.js';
import { ALPHABET } from './constants.js';

let isCheckInProgress = false;
let lastInputEventTime = 0;

export const events = {
    init() {
        this.bindGlobal();
        this.bindSwipe();
    },

    bindGlobal() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Delegate Modal Open
            const openModalBtn = target.closest('[data-action="openModal"]');
            if (openModalBtn) {
                ui.openModal(openModalBtn.dataset.muscle);
                return;
            }

            // Delegate Toggle
            const toggleBtn = target.closest('[data-action="toggle"]');
            if (toggleBtn) {
                this.toggle(toggleBtn.dataset.key, toggleBtn);
                return;
            }

            // Delegate Check Auto Finish on Focus
            if (target.matches('input.rep-input')) {
                // Attach non-delegated listeners for specific input events if needed, 
                // or handle via 'focusin'/'change'/'keydown' on document/container
                // For simplicity, we can let the input inline events be replaced by global delegation?
                // But replacing all inline events is hard without re-writing render.
                // In UI render, we removed on* attributes but added classes/data attributes.
                // So we need to handle them here.
            }

            // Mobile Nav
            const navBtn = target.closest('[data-action="switchMobileDay"]');
            if (navBtn && !navBtn.disabled) {
                ui.switchMobileDay(parseInt(navBtn.dataset.delta));
            }
        });

        // focusin обработчик удалён - больше не блокирует переключение фокуса

        // change срабатывает при изменении значения и потере фокуса
        // blur срабатывает при любой потере фокуса (для надёжности)
        const handleInputSave = (e) => {
            if (e.target.matches('input.rep-input')) {
                this.setReps(e.target.dataset.key, e.target);
            }
        };

        document.getElementById('log').addEventListener('change', handleInputSave);
        document.getElementById('log').addEventListener('blur', handleInputSave, true);

        document.getElementById('log').addEventListener('keydown', (e) => {
            if (e.target.matches('input.rep-input')) {
                this.handleEnter(e, e.target);
            }
        });

        // Global functions exposed to window for historical reasons or specific callbacks?
        // No, we try to contain them.
    },

    bindSwipe() {
        let touchStartX = 0;
        let touchEndX = 0;
        const card = document.querySelector('#view-workout .card');

        if (!card) return;

        card.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        card.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) ui.switchMobileDay(1);
            if (touchEndX > touchStartX + 50) ui.switchMobileDay(-1);
        }, { passive: true });
    },

    // Logic moved from app.js
    // Только сохраняет данные программно, НЕ вмешивается в фокус
    setReps(key, input) {
        console.log('setReps called:', key, input.value);
        const val = input.value;
        const colKey = key.split('_').slice(1).join('_');

        let num = parseFloat(val);
        if (num < 0) num = 0;
        if (num > 999) num = 999;

        const isValid = !isNaN(num) && val !== '';

        store.state[key] = store.state[key] || { reps: '', done: false };
        store.state[key].reps = isValid ? num : '';

        store.state._activeCol = colKey;

        // Обновляем мобильный день на основе редактируемого поля
        this.updateMobileDayFromKey(colKey);

        if (isValid) {
            if (!store.state[key].done) {
                store.state[key].done = true;
                store.addStat(key, num);
                if (document.getElementById('view-analytics').style.display !== 'none') {
                    ui.renderHighLevelAnalytics();
                }
            }
        } else {
            store.state[key].done = false;
        }

        // Сохраняем данные локально без notify
        store.saveData(true);

        // Обновление UI и синхронизация через 100мс - после установки фокуса на новое поле
        const isDone = store.state[key].done;
        setTimeout(() => {
            // Обновляем UI
            const btn = input.nextElementSibling;
            if (isDone) {
                input.disabled = true;
                if (btn) btn.classList.add('done');
            } else {
                input.disabled = false;
                if (btn) btn.classList.remove('done');
            }
            // Синхронизация с облаком
            store.notify('local');

            // Проверяем, завершён ли подход — если да, переключаемся
            this.checkAndSwitchColumn(colKey);
        }, 100);

        lastInputEventTime = Date.now();
    },

    toggle(key, btn) {
        if (Date.now() - lastInputEventTime < 300) return;
        const colKey = key.split('_').slice(1).join('_');
        const status = this.checkAutoFinish(colKey);

        if (status === 'CANCELLED') return;

        store.state[key] = store.state[key] || { reps: '', done: false };

        if (!store.state[key].done && (store.state[key].reps === '' || store.state[key].reps === null)) {
            ui.showToast('Укажите количество минут', true);
            if (status === 'SWITCHED') ui.render();
            return;
        }

        store.state[key].done = !store.state[key].done;
        store.state._activeCol = colKey;

        // Обновляем мобильный день на основе редактируемого поля
        this.updateMobileDayFromKey(colKey);

        if (status === 'SWITCHED') {
            ui.render();
        } else {
            ui.updateHighlights();
            btn.classList.toggle('done');
            const input = btn.previousElementSibling;
            if (input) input.disabled = store.state[key].done;
        }

        if (store.state[key].done) {
            store.addStat(key, Number(store.state[key].reps) || 0);
            ui.renderStats();
            if (document.getElementById('view-analytics').style.display !== 'none') {
                ui.renderHighLevelAnalytics();
            }
        }

        store.saveData();

        // Проверяем, завершён ли подход — если да, переключаемся
        if (store.state[key].done) {
            this.checkAndSwitchColumn(colKey);
        }
    },

    handleEnter(event, input) {
        const isEnter = event.key === 'Enter' || event.keyCode === 13;

        // Tab НЕ перехватываем - пусть работает нативно
        if (!isEnter) return;

        event.preventDefault();

        const key = input.dataset.key;
        this.setReps(key, input);
        this.focusNext(input);
    },

    focusNext(currentInput) {
        const currentTabIndex = parseInt(currentInput.getAttribute('tabindex'));
        let nextIndex = currentTabIndex + 1;
        let maxChecks = 100;
        while (maxChecks > 0) {
            const nextInput = document.querySelector(`input[tabindex="${nextIndex}"]`);
            if (!nextInput) break;
            if (!nextInput.disabled) {
                nextInput.focus();
                nextInput.select();
                break;
            }
            nextIndex++;
            maxChecks--;
        }
    },

    checkAutoFinish(targetCol) {
        if (isCheckInProgress) {
            // Не перемещаем фокус во время обработки диалога
            return 'CANCELLED';
        }

        if (!store.state._activeCol || store.state._activeCol === targetCol) return false;

        const hasData = muscles.some(m => {
            const k = keyOf(m, ...store.state._activeCol.split('_'));
            const s = store.state[k];
            return s && (s.done || (s.reps !== '' && s.reps != null));
        });

        if (hasData) {
            isCheckInProgress = true;
            // Сохраняем текущий активный элемент перед блокирующим confirm
            const activeElement = document.activeElement;

            if (confirm('Закончить текущий подход?')) {
                this.finishSet();
                setTimeout(() => { isCheckInProgress = false; }, 100);
                return 'SWITCHED';
            } else {
                // При отмене - восстанавливаем фокус на целевой элемент
                setTimeout(() => {
                    if (activeElement && activeElement.focus) {
                        activeElement.focus();
                    }
                    isCheckInProgress = false;
                }, 50);
                return 'CANCELLED';
            }
        }
        return false;
    },

    refocusActiveColumn() {
        if (!store.state._activeCol) return;
        const inputs = document.querySelectorAll(`td[data-col="${store.state._activeCol}"] input`);
        let found = false;
        // Logic to find first unfinished
        for (let i = 0; i < muscles.length; i++) {
            const k = `${muscles[i]}_${store.state._activeCol}`;
            if (!store.state[k] || !store.state[k].done) {
                if (inputs[i]) {
                    inputs[i].focus();
                    found = true;
                    break;
                }
            }
        }
        if (!found && inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    },

    finishSet() {
        // Проверяем, что все поля текущего подхода заполнены
        if (store.state._activeCol) {
            const hasEmpty = muscles.some(m => {
                const k = keyOf(m, ...store.state._activeCol.split('_'));
                const s = store.state[k];
                return !s || !s.done;
            });

            if (hasEmpty) {
                ui.showToast('Заполните все поля текущего подхода', true);
                return;
            }
        }

        // Находим следующий незаполненный подход
        const nextCol = this.findFirstIncompleteColumn();

        if (nextCol) {
            store.state._activeCol = nextCol;
            store.saveData();
            ui.render();
        } else {
            if (confirm('Все подходы выполнены. Завершить тренировку?')) {
                store.state._activeCol = null;
                store.saveData();
                ui.render();
            }
        }
    },

    findFirstIncompleteColumn() {
        const trainings = getTrainings(store.config.days);
        const sets = getSets(store.config.sets);

        for (let t of trainings) {
            for (let s of sets) {
                const colKey = `${t}_${s}`;
                const hasIncomplete = muscles.some(m => {
                    const k = keyOf(m, t, s);
                    const cell = store.state[k];
                    return !cell || !cell.done;
                });
                if (hasIncomplete) {
                    return colKey;
                }
            }
        }
        return null; // Все заполнены
    },

    // Проверяет, завершён ли подход, и переключает на следующий
    checkAndSwitchColumn(colKey) {
        // Проверяем, все ли поля текущего подхода заполнены
        const isComplete = !muscles.some(m => {
            const k = keyOf(m, ...colKey.split('_'));
            const cell = store.state[k];
            return !cell || !cell.done;
        });

        if (isComplete) {
            // Ищем следующий незаполненный подход
            const nextCol = this.findFirstIncompleteColumn();
            if (nextCol && nextCol !== colKey) {
                store.state._activeCol = nextCol;
                store.saveData();
                ui.render();
                ui.showToast('Подход завершён! Переход к следующему.');
            } else if (!nextCol) {
                // Все подходы завершены
                ui.showToast('Все подходы выполнены! 🎉');
                ui.updateHighlights();
            }
        }
    },

    autoFillCurrentSet(muscle, value, markDone = false) {
        this.ensureActiveColumn();
        const activeCol = store.state._activeCol;
        const [t, s] = activeCol.split('_');
        const key = keyOf(muscle, t, s);
        const cell = store.state[key] || { reps: '', done: false };
        const currentVal = parseFloat(cell.reps) || 0;
        cell.reps = currentVal + value;

        if (markDone) {
            cell.done = true;
            store.addStat(key, Number(cell.reps) || 0);
            if (document.getElementById('view-analytics').style.display !== 'none') {
                ui.renderHighLevelAnalytics();
            }
        }

        store.state[key] = cell;
        store.saveData();
        ui.render();
    },

    ensureActiveColumn() {
        // Если есть активная колонка и она незавершена — оставляем её
        if (store.state._activeCol) {
            const hasIncomplete = muscles.some(m => {
                const k = keyOf(m, ...store.state._activeCol.split('_'));
                const cell = store.state[k];
                return !cell || !cell.done;
            });
            if (hasIncomplete) {
                return store.state._activeCol;
            }
        }

        // Ищем первый незаполненный подход
        const nextCol = this.findFirstIncompleteColumn();
        if (nextCol) {
            store.state._activeCol = nextCol;
            store.saveData();
            return nextCol;
        }

        // Всё заполнено — оставляем последний
        const trainings = getTrainings(store.config.days);
        const sets = getSets(store.config.sets);
        store.state._activeCol = `${trainings[trainings.length - 1]}_${sets[sets.length - 1]}`;
        store.saveData();
        return store.state._activeCol;
    },

    // Обновляет мобильный день на основе ключа колонки (например "A_1" -> день 0)
    updateMobileDayFromKey(colKey) {
        if (!colKey) return;

        const dayLetter = colKey.split('_')[0]; // "A", "B", "C"...
        const dayIndex = ALPHABET.indexOf(dayLetter);

        if (dayIndex !== -1 && dayIndex < store.config.days) {
            ui.mobileDayIndex = dayIndex;
            ui.updateMobileNavControls();
            ui.applyMobileVisibility();
        }
    }
};

// Global Exposure needed for HTML onclick bindings that are not yet removed, 
// OR simpler: we migrated all interactions to event delegation!
// Wait, we have some buttons in index.html like `finishSet`, `toggleZapper`, `changeWeek`, `switchTab`, `closeModal`.
// We need to attach these to window for the HTML to see them OR rewrite the HTML to remove onclicks.
// Plan said "Remove onclick attributes from HTML generation", which handles the Table.
// But the static HTML still has onclicks.
// We should probably Attach these in app.js or here.

export function setupWindowExports() {
    window.switchTab = ui.switchTab.bind(ui);
    window.changeWeek = (d) => { store.changeWeek(d); store.saveData(); events.ensureActiveColumn(); ui.render(); };
    window.finishSet = events.finishSet.bind(events);
    window.toggleZapper = zapper.toggle.bind(zapper);
    window.closeModal = ui.closeModal.bind(ui);
    window.adjustSetting = (id, delta) => {
        const input = document.getElementById(id);
        let val = parseInt(input.value) + delta;
        if (val < 1) val = 1;
        if (val > 20) val = 20;
        input.value = val;
    };
    window.saveSettings = () => {
        const d = parseInt(document.getElementById('setting-days').value);
        const s = parseInt(document.getElementById('setting-sets').value);
        if (store.config.days === d && store.config.sets === s) {
            ui.showToast('Изменений нет');
            return;
        }
        store.saveConfig({ days: d, sets: s });
        // Reload globals? Store handles it.
        ui.render();
        ui.showToast('Настройки сохранены');
    };

    // Timer controls in Modal
    window.addTime = (s) => ui.addTime(s, audio);
    window.toggleTimer = () => ui.toggleTimer(audio);
    window.resetTimer = () => ui.resetTimer();
    window.confirmResult = () => {
        events.autoFillCurrentSet(ui.currentMuscle, ui.currentBaseTime, true);
        document.getElementById('fixResultBtn').style.display = 'none';
        ui.closeModal();
    };
}
