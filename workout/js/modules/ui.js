import { store } from './store.js';
import { getWeekDays, getWeekMonday, isDateInRange, keyOf, getTrainings, getSets, formatTime } from './utils.js';
import { muscles, muscleImages, muscleDescriptions, exerciseConfig } from '../data.js';
import { zapper } from './audio.js';

export const ui = {
    // Mobile State
    mobileDayIndex: 0,
    mobileInitDone: false,

    // Timer State
    timerInterval: null,
    timerTime: 0,
    currentBaseTime: 60,
    timerRunning: false,
    timerIsCountdown: true,
    currentMuscle: '',
    isSecondSide: false,

    init() {
        // Version Info
        try {
            const vDiv = document.getElementById('appVersion');
            if (vDiv) {
                const date = new Date(document.lastModified);
                const fmt = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                vDiv.innerText = 'v.' + fmt;
            }
        } catch (e) { }
    },

    render() {
        const table = document.getElementById('log');
        if (!table) return;
        table.innerHTML = '';

        this.updateWeekLabel();

        const dates = getWeekDays(store.config.days, store.currentWeekOffset);
        const trainings = getTrainings(store.config.days);
        const sets = getSets(store.config.sets);

        // Mobile Nav Injection
        this.updateMobileNavControls();

        const thead = document.createElement('thead');

        const weekStart = getWeekMonday(store.currentWeekOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // Row 1: Dates / Groups
        let row1 = '<tr><th class="desktop-only"></th>';
        trainings.forEach((t, i) => {
            const start = dates[i];
            let end;
            if (i < dates.length - 1) {
                const nextStart = dates[i + 1];
                end = new Date(nextStart);
                end.setDate(end.getDate() - 1);
            } else {
                end = weekEnd;
            }

            const isCurrent = isDateInRange(new Date(), start, end);
            const startStr = start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            const endStr = end.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            const labelText = `${startStr} - ${endStr}`;

            row1 += `
      <th colspan="${sets.length}" class="day-header ${isCurrent ? 'current' : ''} desktop-only" data-day-index="${i}">
        <div class="brace-wrapper">
          <span class="brace-label">${labelText}</span>
          <svg class="brace-path" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,10 Q40,10 50,2 Q60,10 100,10" />
          </svg>
        </div>
      </th>`;

            // Auto-detect current day for mobile init
            if (new Date().toDateString() === start.toDateString() && !this.mobileInitDone) {
                this.mobileDayIndex = i;
                this.mobileInitDone = true;
            }
        });
        row1 += '</tr>';

        // Row 2: Columns
        let row2 = '<tr><th class="desktop-only" style="top:45px">Мышцы</th>';

        const headerHtml = trainings.map((t, i) => sets.map(s => {
            const key = `${t}_${s}`;
            const isActive = store.state._activeCol === key;
            return `<th data-col="${key}" class="${isActive ? 'active-col-header' : ''} desktop-only" style="top:40px;" data-day-index="${i}">${t}${s}</th>`;
        }).join('')).join('');

        row2 += headerHtml + '</tr>';

        thead.innerHTML = row1 + row2;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        muscles.forEach((m, mIndex) => {
            const tr = document.createElement('tr');
            tr.style.setProperty('--sets-count', sets.length);

            tr.innerHTML = `<td class="group" data-action="openModal" data-muscle="${m}">${m}</td>`;

            trainings.forEach((t, tIndex) => {
                sets.forEach((s, sIndex) => {
                    const key = keyOf(m, t, s);
                    const colKey = `${t}_${s}`;
                    const isActive = store.state._activeCol === colKey;
                    const colIndex = tIndex * sets.length + sIndex;
                    const tabIndex = colIndex * muscles.length + mIndex + 1;

                    const cell = store.state[key] || { reps: '', done: false };
                    const td = document.createElement('td');
                    td.dataset.col = colKey;
                    td.dataset.dayIndex = tIndex;
                    td.className = isActive ? 'active-col-cell set-cell' : 'set-cell';

                    const disabledAttr = cell.done ? 'disabled' : '';
                    td.innerHTML = `
            <div class="cell">
            <input type="number" 
                    value="${cell.reps}" 
                    min="0" max="999"
                    ${disabledAttr}
                    data-key="${key}"
                    tabindex="${tabIndex}"
                    enterkeyhint="done"
                    class="rep-input">
            <button class="set ${cell.done ? 'done' : ''}" data-action="toggle" data-key="${key}">✓</button>
            </div>`;
                    tr.appendChild(td);
                });
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        this.applyMobileVisibility();
    },

    updateWeekLabel() {
        const start = getWeekMonday(store.currentWeekOffset);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        const opts = { month: 'short', day: 'numeric' };
        let text = `${start.toLocaleDateString('ru-RU', opts)} - ${end.toLocaleDateString('ru-RU', opts)}`;

        if (store.currentWeekOffset === 0) text += " (Текущая)";

        const label = document.getElementById('weekNavLabel');
        if (label) label.innerText = text;
    },

    updateMobileNavControls() {
        let container = document.getElementById('mobile-nav-controls');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mobile-nav-controls';
            container.className = 'mobile-nav-controls';
            const workoutView = document.getElementById('view-workout');
            const card = workoutView.querySelector('.card');
            workoutView.insertBefore(container, card);
        }

        const dates = getWeekDays(store.config.days, store.currentWeekOffset);
        const trainings = getTrainings(store.config.days);
        const currentDate = dates[this.mobileDayIndex];

        // Handle case where day index might be out of bounds after config change
        if (!currentDate) {
            this.mobileDayIndex = 0;
            return this.updateMobileNavControls();
        }

        const dateStr = currentDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
        const dayLabel = trainings[this.mobileDayIndex];

        container.innerHTML = `
            <button data-action="switchMobileDay" data-delta="-1" ${this.mobileDayIndex <= 0 ? 'disabled' : ''}>←</button>
            <div class="mobile-day-info">
                <div class="day-letter">День ${dayLabel}</div>
                <div class="day-date">${dateStr}</div>
            </div>
            <button data-action="switchMobileDay" data-delta="1" ${this.mobileDayIndex >= store.config.days - 1 ? 'disabled' : ''}>→</button>
        `;
    },

    switchMobileDay(delta) {
        const newIndex = this.mobileDayIndex + delta;
        if (newIndex >= 0 && newIndex < store.config.days) {
            this.mobileDayIndex = newIndex;
            this.updateMobileNavControls();
            this.applyMobileVisibility();
        }
    },

    applyMobileVisibility() {
        const table = document.getElementById('log');
        if (table) {
            table.setAttribute('data-active-day', this.mobileDayIndex);
        }
    },

    updateHighlights() {
        const activeKey = store.state._activeCol;
        document.querySelectorAll('th[data-col]').forEach(th => {
            th.classList.toggle('active-col-header', th.dataset.col === activeKey);
        });
        document.querySelectorAll('td[data-col]').forEach(td => {
            td.classList.toggle('active-col-cell', td.dataset.col === activeKey);
        });
    },

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        const targetBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        document.getElementById('view-workout').style.display = tab === 'workout' ? 'block' : 'none';
        document.getElementById('view-analytics').style.display = tab === 'analytics' ? 'block' : 'none';
        document.getElementById('view-settings').style.display = tab === 'settings' ? 'block' : 'none';

        if (tab === 'settings') {
            document.getElementById('setting-days').value = store.config.days;
            document.getElementById('setting-sets').value = store.config.sets;
        }

        if (tab === 'analytics') {
            this.renderHighLevelAnalytics();
        }
    },

    showToast(msg, isError = false) {
        let toast = document.createElement('div');
        toast.className = isError ? 'toast error' : 'toast';
        toast.innerText = msg;
        document.body.appendChild(toast);
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Modal
    openModal(muscle) {
        this.currentMuscle = muscle;
        this.isSecondSide = false;
        document.getElementById('modalTitle').innerText = muscle;
        document.getElementById('modalImg').src = muscleImages[muscle];
        document.getElementById('modalDesc').innerHTML = muscleDescriptions[muscle] || '';
        document.getElementById('modal').style.display = 'block';

        // Data
        const config = exerciseConfig[muscle] || { time: 60, unilateral: false };
        this.currentBaseTime = config.time;

        // Side Reminder
        const alertBox = document.getElementById('sideAlert');
        if (config.unilateral) {
            alertBox.style.display = 'block';
            alertBox.innerText = '⚠️ Упражнение выполняется на каждую сторону поочередно';
            alertBox.style.borderColor = 'var(--accent)';
            alertBox.style.color = 'var(--accent)';
        } else {
            alertBox.style.display = 'none';
        }
        this.resetTimer();
    },

    closeModal() {
        document.getElementById('modal').style.display = 'none';
        this.stopTimer();
    },

    // Timer Methods
    updateTimerDisplay() {
        document.getElementById('timerDisplay').innerText = formatTime(this.timerTime);
    },

    toggleTimer(audioModule) {
        if (this.timerRunning) {
            this.stopTimer();
        } else {
            this.startTimer(audioModule);
        }
    },

    startTimer(audioModule) {
        if (this.timerRunning) return;

        if (this.timerTime <= 0 && this.timerIsCountdown) {
            this.timerTime = this.currentBaseTime;
            this.updateTimerDisplay();

            if (exerciseConfig[this.currentMuscle]?.unilateral) {
                const alertBox = document.getElementById('sideAlert');
                alertBox.innerText = '⚠️ Упражнение выполняется на каждую сторону поочередно';
                alertBox.style.borderColor = 'var(--accent)';
                alertBox.style.color = 'var(--accent)';
            }
        }

        this.timerRunning = true;
        const btn = document.getElementById('timerToggleBtn');
        btn.innerText = 'Pause';
        btn.classList.add('active');

        this.timerInterval = setInterval(() => {
            if (this.timerIsCountdown) {
                if (this.timerTime > 4) {
                    audioModule.playSound(1200, 0.1, 'sine', 0.5);
                } else if (this.timerTime > 0) {
                    audioModule.playSound(600, 0.2, 'sine', 0.5);
                }

                this.timerTime--;

                if (this.timerTime <= 0) {
                    this.timerTime = 0;
                    audioModule.playSound(800, 0.6, 'square', 0.4);
                    this.stopTimer();

                    const config = exerciseConfig[this.currentMuscle];
                    const isUnilateral = config && config.unilateral;

                    if (isUnilateral) {
                        if (!this.isSecondSide) {
                            this.isSecondSide = true;
                            const alertBox = document.getElementById('sideAlert');
                            alertBox.innerText = '🔄 ПЕРЕМЕНА СТОРОН! ТЕПЕРЬ ДРУГАЯ НОГА';
                            alertBox.style.borderColor = '#fbbf24';
                            alertBox.style.color = '#fbbf24';
                            return;
                        } else {
                            this.isSecondSide = false;
                            document.getElementById('sideAlert').style.display = 'none';
                        }
                    }

                    document.getElementById('fixResultBtn').style.display = 'block';
                }
            } else {
                this.timerTime++;
            }
            this.updateTimerDisplay();
        }, 1000);
    },

    stopTimer() {
        this.timerRunning = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
        const btn = document.getElementById('timerToggleBtn');
        if (btn) {
            btn.innerText = 'Start';
            btn.classList.remove('active');
        }
    },

    resetTimer() {
        this.stopTimer();
        this.timerTime = this.currentBaseTime;
        this.timerIsCountdown = true;
        document.getElementById('fixResultBtn').style.display = 'none';
        this.updateTimerDisplay();
    },

    addTime(seconds, audioModule) {
        if (!this.timerIsCountdown && this.timerTime === 0) {
            this.timerIsCountdown = true;
        }
        if (!this.timerIsCountdown && this.timerTime > 0) {
            this.timerIsCountdown = true;
        }
        this.timerIsCountdown = true;
        this.timerTime += seconds;
        this.updateTimerDisplay();
        if (!this.timerRunning) this.startTimer(audioModule);
    },

    // Analytics
    renderHighLevelAnalytics() {
        const stats = store.getStats();

        if (!stats.length) {
            document.getElementById('stat-workouts').innerText = '0';
            document.getElementById('stat-sets').innerText = '0';
            document.getElementById('stat-time').innerText = '0m';
            if (window.histChart && typeof window.histChart.destroy === 'function') window.histChart.destroy();
            if (window.distChart && typeof window.distChart.destroy === 'function') window.distChart.destroy();
            document.getElementById('stats').innerHTML = '<span class="subtitle">Нет данных</span>';
            return;
        }

        const dates = new Set();
        let totalSeconds = 0;
        const muscleVol = {};
        const dailyVol = {};

        stats.forEach(s => {
            const d = new Date(s.ts);
            const dateKey = d.toISOString().split('T')[0];
            dates.add(dateKey);

            totalSeconds += s.reps;

            const m = s.key.split('_')[0];
            muscleVol[m] = (muscleVol[m] || 0) + s.reps;

            dailyVol[dateKey] = (dailyVol[dateKey] || 0) + s.reps;
        });

        const uniqueSets = new Set(stats.map(s => {
            const parts = s.key.split('_');
            const colKey = `${parts[1]}_${parts[2]}`;
            const d = new Date(s.ts).toISOString().split('T')[0];
            return `${colKey}_${d}`;
        }));

        document.getElementById('stat-workouts').innerText = dates.size;
        document.getElementById('stat-sets').innerText = uniqueSets.size;

        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        document.getElementById('stat-time').innerText = hrs > 0 ? `${hrs}ч ${mins}м` : `${mins} мин`;

        // Charts
        const sortedDays = Object.keys(dailyVol).sort();
        const dayLabels = sortedDays.map(d => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
        const dayData = sortedDays.map(d => Math.round(dailyVol[d] / 60));

        const ctxHist = document.getElementById('historyChart').getContext('2d');
        if (window.histChart && typeof window.histChart.destroy === 'function') window.histChart.destroy();
        window.histChart = new Chart(ctxHist, {
            type: 'line',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Нагрузка (мин)',
                    data: dayData,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#1f2937' }, ticks: { color: '#9ca3af' } },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });

        const muscleLabels = Object.keys(muscleVol);
        const muscleData = Object.values(muscleVol).map(s => Math.round(s / 60));

        const ctxDist = document.getElementById('distChart').getContext('2d');
        if (window.distChart && typeof window.distChart.destroy === 'function') window.distChart.destroy();
        window.distChart = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: muscleLabels,
                datasets: [{
                    data: muscleData,
                    backgroundColor: ['#38bdf8', '#22c55e', '#fbbf24', '#f472b6', '#a78bfa'],
                    borderWidth: 0
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'right', labels: { color: '#e5e7eb' } }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });

        this.renderStats(muscleVol);
    },

    renderStats(muscleVol) {
        if (!muscleVol) {
            const stats = store.getStats();
            muscleVol = {};
            stats.forEach(e => {
                const m = e.key.split('_')[0];
                muscleVol[m] = (muscleVol[m] || 0) + e.reps;
            });
        }

        const box = document.getElementById('stats');
        // Simple recalculate sets for summary
        const stats = store.getStats();
        const sum = {};
        stats.forEach(e => {
            const m = e.key.split('_')[0];
            sum[m] = sum[m] || { sets: 0, reps: 0 };
            sum[m].sets++; sum[m].reps += e.reps;
        });

        box.innerHTML = `
        <h3 style="margin-top:0; font-size:16px; margin-bottom:12px;">Сводка по упражнениям</h3>
        <div class="stats-grid">
            ${Object.entries(sum).map(([m, v]) => `
            <div class="stat">
              <div class="label">${m}</div>
              <div class="value" style="font-size:16px;">${v.sets} п. · ${Math.round(v.reps / 60)} мин</div>
            </div>`).join('')}
        </div>`;
    }
};
