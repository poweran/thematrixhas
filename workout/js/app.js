const CONFIG_KEY = 'home_workout_config_v1';
let config = JSON.parse(localStorage.getItem(CONFIG_KEY)) || { days: 2, sets: 4 };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let trainings = ALPHABET.slice(0, config.days).split('');
let sets = Array.from({ length: config.sets }, (_, i) => i + 1);

const STORAGE_KEY_BASE = 'home_workout_table_v1';
// Legacy support
const LEGACY_STORAGE_KEY = 'home_workout_table_v1';

const STATS_KEY = 'home_workout_stats_v1';

let currentWeekOffset = 0;
let state = {};

function getWeekId(offset = 0) {
    const d = new Date();
    // Adjust to Monday of the target week
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1) + (offset * 7);
    const targetMonday = new Date(d.setDate(diff));

    // ISO Week Year formulation is complex, let's use Simple YYYY-Www format
    // Actually, simple Monday date string is unique enough: YYYY-MM-DD
    const y = targetMonday.getFullYear();
    const m = (targetMonday.getMonth() + 1).toString().padStart(2, '0');
    const dd = targetMonday.getDate().toString().padStart(2, '0');

    return `${y}-${m}-${dd}`;
}

function loadState() {
    const weekId = getWeekId(currentWeekOffset);
    const key = `${STORAGE_KEY_BASE}_${weekId}`;
    const loaded = localStorage.getItem(key);

    if (loaded) {
        state = JSON.parse(loaded);
    } else {
        // Migration Logic: If current week (offset 0) and no new data, check legacy
        if (currentWeekOffset === 0) {
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
                console.log('Migrating legacy data to current week...');
                state = JSON.parse(legacy);
                // Save immediately to new format
                saveData();
            } else {
                state = {};
            }
        } else {
            state = {};
        }
    }
}

function saveData() {
    const weekId = getWeekId(currentWeekOffset);
    const key = `${STORAGE_KEY_BASE}_${weekId}`;
    localStorage.setItem(key, JSON.stringify(state));

    // Sync to legacy key ONLY if it's the current week, to maintain backup/compatibility if needed
    if (currentWeekOffset === 0) {
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    }
}

const keyOf = (m, t, s) => `${m}_${t}_${s}`;

function render() {
    const table = document.getElementById('log');
    table.innerHTML = '';

    updateWeekLabel();

    const dates = getWeekDays(config.days, currentWeekOffset);

    const thead = document.createElement('thead');

    const weekStart = getWeekMonday(currentWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Row 1: Dates / Groups
    let row1 = '<tr><th></th>';
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
      <th colspan="${sets.length}" class="day-header ${isCurrent ? 'current' : ''}">
        <div class="brace-wrapper">
          <span class="brace-label">${labelText}</span>
          <svg class="brace-path" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,10 Q40,10 50,2 Q60,10 100,10" />
          </svg>
        </div>
      </th>`;
    });
    row1 += '</tr>';

    // Row 2: Columns
    let row2 = '<tr><th style="top:45px">Мышцы</th>'; // Adjust sticky top if needed, assuming default header height
    // Actually with two rows sticky might be tricky. Let's try standard sticky.
    // We need to adjust 'top' for the second row if we want both sticky.
    // For now let's just keep standard structure in tbody or make 'th' sticky. 
    // Existing CSS: thead th { top: 0; sticky... }
    // If we have 2 rows, first row is top:0, second row needs top: heightOfFirstRow.
    // Let's approximate height or let JS handle it?
    // CSS is simple `top: 0`. It will stack if we are lucky or overlap. 
    // `position: sticky` on multiple rows works in modern browsers by stacking? No, often they overlap.
    // Let's set styled top for second row.

    const headerHtml = trainings.map(t => sets.map(s => {
        const key = `${t}_${s}`;
        const isActive = state._activeCol === key;
        return `<th data-col="${key}" class="${isActive ? 'active-col-header' : ''}" style="top:40px;">${t}${s}</th>`;
    }).join('')).join(''); // 40px is approx height of row 1

    row2 += headerHtml + '</tr>';

    thead.innerHTML = row1 + row2;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    muscles.forEach((m, mIndex) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="group" onclick="openModal('${m}')">${m}</td>`;

        trainings.forEach((t, tIndex) => sets.forEach((s, sIndex) => {
            const key = keyOf(m, t, s);
            const colKey = `${t}_${s}`;
            const isActive = state._activeCol === colKey;

            // Calculate tabindex for vertical navigation
            const colIndex = tIndex * sets.length + sIndex;
            const tabIndex = colIndex * muscles.length + mIndex + 1;

            const cell = state[key] || { reps: '', done: false };
            const td = document.createElement('td');
            td.dataset.col = colKey;
            if (isActive) td.classList.add('active-col-cell');

            const disabledAttr = cell.done ? 'disabled' : '';
            td.innerHTML = `
    <div class="cell">
      <input type="number" 
              value="${cell.reps}" 
              min="0" max="999"
              ${disabledAttr}
              tabindex="${tabIndex}"
              onfocus="checkAutoFinish('${colKey}')"
              onchange="setReps('${key}',this.value)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();setReps('${key}',this.value);toggle('${key}',this.nextElementSibling);focusNext(this);}">
      <button class="set ${cell.done ? 'done' : ''}" onclick="toggle('${key}',this)">✓</button>
    </div>`;
            tr.appendChild(td);
        }));

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
}

function focusNext(currentInput) {
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
}

function setReps(key, val) {
    const colKey = key.split('_').slice(1).join('_');
    const switched = checkAutoFinish(colKey);

    let num = parseFloat(val);
    if (num < 0) num = 0;
    if (num > 999) num = 999;
    state[key] = state[key] || { reps: '', done: false };
    state[key].reps = isNaN(num) ? '' : num;
    saveData();

    if (switched || val != state[key].reps) render();
}

function toggle(key, btn) {
    const colKey = key.split('_').slice(1).join('_');
    const switched = checkAutoFinish(colKey);

    state[key] = state[key] || { reps: '', done: false };

    if (!state[key].done && (state[key].reps === '' || state[key].reps === null)) {
        showToast('Укажите количество минут', true);
        if (switched) render(); // Ensure UI is consistent if we switched but failed validation
        return;
    }

    state[key].done = !state[key].done;

    if (switched) {
        render();
    } else {
        btn.classList.toggle('done');
        const input = btn.previousElementSibling;
        if (input) input.disabled = state[key].done;
    }

    if (state[key].done) {
        const stats = JSON.parse(localStorage.getItem(STATS_KEY)) || [];
        stats.push({ key, reps: Number(state[key].reps) || 0, ts: Date.now() });
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        renderStats();

        // Update analytics charts if visible
        if (document.getElementById('view-analytics').style.display !== 'none') {
            renderHighLevelAnalytics();
        }
    }

    saveData();
}

function checkAutoFinish(targetCol) {
    if (!state._activeCol || state._activeCol === targetCol) return false;

    const hasDone = muscles.some(m => {
        const k = `${m}_${state._activeCol}`;
        return state[k] && state[k].done;
    });

    if (hasDone) {
        if (confirm('Закончить текущий подход?')) {
            finishSet();
            return true;
        }
    }
    return false;
}

function finishSet() {
    // 1. Identify all columns in order
    const allCols = [];
    trainings.forEach(t => sets.forEach(s => allCols.push(`${t}_${s}`)));

    // 2. Find current index
    const currentIndex = allCols.indexOf(state._activeCol);

    // 3. Determine next
    let nextIndex = -1;
    if (currentIndex === -1) {
        // If not set, start at 0? Or just leave it to auto-fill?
        // Let's start at 0 if nothing active.
        nextIndex = 0;
    } else {
        nextIndex = currentIndex + 1;
    }

    // 4. Update or Finish
    if (nextIndex < allCols.length) {
        state._activeCol = allCols[nextIndex];
        saveData();
        render(); // Re-render to update highlight

        // Visual feedback
        // alert(`Переход к подходу ${state._activeCol.replace('_', '')}`);
    } else {
        if (confirm('Это был последний подход. Завершить тренировку?')) {
            state._activeCol = null;
            saveData();
            render();
        }
    }
}



let currentMuscle = ''; // Ensure variable exists
let isSecondSide = false;

function openModal(muscle) {
    currentMuscle = muscle;
    isSecondSide = false;
    document.getElementById('modalTitle').innerText = muscle;
    document.getElementById('modalImg').src = muscleImages[muscle];
    document.getElementById('modalDesc').innerHTML = muscleDescriptions[muscle] || '';
    document.getElementById('modal').style.display = 'block';

    // Data
    const config = exerciseConfig[muscle] || { time: 60, unilateral: false };
    currentBaseTime = config.time;

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
    resetTimer();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    stopTimer(); // Ensure timer stops when closing
}

// Timer Logic
let timerInterval = null;
let timerTime = 0;
let currentBaseTime = 60;
let timerRunning = false;
let timerIsCountdown = true;

function formatTime(t) {
    const m = Math.floor(Math.abs(t) / 60).toString().padStart(2, '0');
    const s = (Math.abs(t) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerDisplay() {
    document.getElementById('timerDisplay').innerText = formatTime(timerTime);
}

function toggleTimer() {
    if (timerRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (timerRunning) return;

    // Reset timer if starting from 0 (e.g. for second side or next set)
    if (timerTime <= 0 && timerIsCountdown) {
        timerTime = currentBaseTime;
        updateTimerDisplay();

        // Reset side alert message if applicable
        if (exerciseConfig[currentMuscle]?.unilateral) {
            const alertBox = document.getElementById('sideAlert');
            alertBox.innerText = '⚠️ Упражнение выполняется на каждую сторону поочередно';
            alertBox.style.borderColor = 'var(--accent)';
            alertBox.style.color = 'var(--accent)';
        }
    }

    timerRunning = true;
    const btn = document.getElementById('timerToggleBtn');
    btn.innerText = 'Pause';
    btn.classList.add('active');

    timerInterval = setInterval(() => {
        if (timerIsCountdown) {
            // Sound effects (louder and improved timing)
            if (timerTime > 4) {
                playSound(1200, 0.1, 'sine', 0.5); // Louder tick
            } else if (timerTime > 0) {
                playSound(600, 0.2, 'sine', 0.5); // Countdown beeps
            }

            timerTime--;

            if (timerTime <= 0) {
                timerTime = 0;
                playSound(800, 0.6, 'square', 0.4); // Finish sound
                stopTimer();

                // Unilateral check & Auto-log
                const config = exerciseConfig[currentMuscle];
                const isUnilateral = config && config.unilateral;

                if (isUnilateral) {
                    if (!isSecondSide) {
                        isSecondSide = true;
                        const alertBox = document.getElementById('sideAlert');
                        alertBox.innerText = '🔄 ПЕРЕМЕНА СТОРОН! ТЕПЕРЬ ДРУГАЯ НОГА';
                        alertBox.style.borderColor = '#fbbf24';
                        alertBox.style.color = '#fbbf24';
                        return;
                    } else {
                        isSecondSide = false;
                        document.getElementById('sideAlert').style.display = 'none';
                    }
                }

                // Show manual fix button instead of auto-fill
                document.getElementById('fixResultBtn').style.display = 'block';
                // autoFillCurrentSet(currentMuscle, currentBaseTime);
            }
        } else {
            timerTime++;
        }
        updateTimerDisplay();
    }, 1000);
}

function confirmResult() {
    autoFillCurrentSet(currentMuscle, currentBaseTime, true);
    document.getElementById('fixResultBtn').style.display = 'none';
    closeModal();
}

// Audio Context & Zapper Logic
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSound(freq, duration, type, vol = 1) {
    const ctx = initAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
}

const zapper = {
    active: false,
    nodes: [],
    analyser: null,
    dataArray: null,
    animationId: null,

    toggle() {
        if (this.active) this.stop();
        else this.start();
        this.updateUI();
    },

    start() {
        const ctx = initAudio();
        this.nodes = [];
        this.audioStartTime = ctx.currentTime;

        // Output & Analyser Setup
        const masterGain = ctx.createGain();
        masterGain.gain.value = 1.0;
        masterGain.connect(ctx.destination);
        this.nodes.push(masterGain);

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        masterGain.connect(this.analyser);

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        // 1. 30kHz Square Wave
        const mainOsc = ctx.createOscillator();
        mainOsc.type = 'square';
        mainOsc.frequency.value = 30000;

        const offset = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
        if (offset.offset) offset.offset.value = 1;
        else { offset.frequency.value = 0; offset.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([1, 1]), new Float32Array([0, 0]))); }

        const combiner = ctx.createGain();
        combiner.gain.value = 0.5;

        mainOsc.connect(combiner);
        offset.connect(combiner);
        combiner.connect(masterGain);

        mainOsc.start();
        offset.start();
        this.nodes.push(mainOsc, offset, combiner);

        // 2. High Frequencies Sweep
        this.sweepRanges = [[77000, 400000], [350000, 500000], [500000, 900000]];
        this.sweepRanges.forEach(([min, max]) => {
            const sweepOsc = ctx.createOscillator();
            sweepOsc.type = 'square';
            sweepOsc.frequency.value = (min + max) / 2;

            const lfo = ctx.createOscillator();
            lfo.type = 'triangle';
            lfo.frequency.value = 0.2; // 5s period

            const lfoGain = ctx.createGain();
            lfoGain.gain.value = (max - min) / 2;

            lfo.connect(lfoGain);
            lfoGain.connect(sweepOsc.frequency);

            const vol = ctx.createGain();
            vol.gain.value = 0.1;

            sweepOsc.connect(vol);
            vol.connect(masterGain);

            sweepOsc.start();
            lfo.start();
            this.nodes.push(sweepOsc, lfo, lfoGain, vol);
        });

        this.active = true;
        this.drawScope();
    },

    stop() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.nodes.forEach(n => {
            try { n.stop(); } catch (e) { }
            n.disconnect();
        });
        if (this.analyser) this.analyser.disconnect();
        this.nodes = [];
        this.active = false;

        // Clear canvas
        const canvas = document.getElementById('zapperScope');
        const cCtx = canvas.getContext('2d');
        cCtx.clearRect(0, 0, canvas.width, canvas.height);
    },

    drawScope() {
        if (!this.active) return;
        this.animationId = requestAnimationFrame(() => this.drawScope());

        const canvas = document.getElementById('zapperScope');
        const cCtx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Get Audio Time for Sync
        const ctx = this.nodes[0] ? this.nodes[0].context : null;
        if (!ctx) return;
        const elapsed = ctx.currentTime - this.audioStartTime;

        cCtx.fillStyle = '#020617';
        cCtx.fillRect(0, 0, width, height);

        // Grid / Zero
        cCtx.lineWidth = 1;
        cCtx.strokeStyle = '#1f2937';
        cCtx.beginPath();
        cCtx.moveTo(0, height / 2);
        cCtx.lineTo(width, height / 2);
        cCtx.stroke();

        // Calculate Frequencies matching LFO (Triangle, 0.2Hz)
        // Triangle LFO Waveform reference: zero -> pos peak -> zero -> neg peak -> zero
        // WebAudio triangle LFO starts at 0 going positive.
        // Period = 1/0.2 = 5s.
        // Normalized LFO value (-1 to 1) at time t:
        // phase = (t * 0.2 * 4) % 4; // 4 segments: 0-1, 1-0, 0--1, -1-0? No.
        // Easier: value = (2/PI) * asin(sin(2*PI * f * t)); This is triangle wave formula -1 to 1.
        const lfoVal = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * 0.2 * elapsed));

        const freqs = [30000];
        this.sweepRanges.forEach(([min, max]) => {
            const center = (min + max) / 2;
            const range = (max - min) / 2;
            freqs.push(center + range * lfoVal);
        });

        // Draw Frequencies Text
        cCtx.font = '10px monospace';
        cCtx.fillStyle = '#38bdf8';
        cCtx.textAlign = 'left';

        // 30kHz
        cCtx.fillText('30 kHz', 4, 10);
        // Sw1
        cCtx.fillText((freqs[1] / 1000).toFixed(0) + ' kHz', 4, 22);

        cCtx.textAlign = 'right';
        // Sw2
        cCtx.fillText((freqs[2] / 1000).toFixed(0) + ' kHz', width - 4, 10);
        // Sw3
        cCtx.fillText((freqs[3] / 1000).toFixed(0) + ' kHz', width - 4, 22);


        // Draw Composite Waveform
        // Since we can't see 30kHz-1MHz on 44kHz sample rate, we simulate the visualization
        // by scaling the time base down to visible frequencies, but keeping relative ratios (ish).
        // Base visual freq: 30kHz -> represented as 3Hz visual wave?

        cCtx.beginPath();
        cCtx.lineWidth = 1.5;
        cCtx.strokeStyle = '#22c55e';
        cCtx.shadowBlur = 4;
        cCtx.shadowColor = 'rgba(34, 197, 94, 0.5)';

        const timeScale = elapsed * 10;

        for (let x = 0; x < width; x++) {
            let y = 0;
            // Normalized X
            const t = x / width;

            // 1. 30kHz Square Base (Visualized as a stable square wave)
            // We'll give it a fixed visual frequency, e.g., 4 cycles across screen
            const basePhase = (t * 4 - timeScale) * Math.PI * 2;
            y += Math.sign(Math.sin(basePhase)) * 0.4;

            // 2. Add Sweeps (Visualized as higher freq sines/noise)
            // Scale visual freq by actual freq ratio relative to 30k
            // 30k = 1. 300k = 10.

            // To prevent chaos, we clamp visual multiplier or it just becomes fill.
            // Let's just add 3 "high freq" components that vary with the calculated freqs
            // scaled down heavily.

            for (let i = 1; i < 4; i++) {
                // Ratio relative to 30k
                const ratio = freqs[i] / 30000;
                // Visual freq
                const vf = 4 * ratio;
                const amp = 0.15; // lower amplitude for sweeps
                y += Math.sin((t * vf - timeScale * ratio) * Math.PI * 2) * amp;
            }

            // Map -1..1 to Height
            // Canvas Height is small (40px). 
            const plotY = (height / 2) - (y * (height / 2.5));

            if (x === 0) cCtx.moveTo(x, plotY);
            else cCtx.lineTo(x, plotY);
        }
        cCtx.stroke();
        cCtx.shadowBlur = 0;
    },

    updateUI() {
        const btn = document.getElementById('zapperBtn');
        const icon = document.getElementById('zapperIcon');
        const canvas = document.getElementById('zapperScope');

        if (this.active) {
            icon.style.opacity = '1';
            icon.style.filter = 'drop-shadow(0 0 5px #38bdf8)';
            btn.style.borderColor = 'var(--accent)';
            btn.style.color = 'var(--accent)';
            canvas.style.display = 'block';
        } else {
            icon.style.opacity = '0.5';
            icon.style.filter = 'none';
            btn.style.borderColor = 'var(--border)';
            btn.style.color = 'var(--text)';
            canvas.style.display = 'none';
        }
    }
};

function toggleZapper() {
    zapper.toggle();
}

function stopTimer() {
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    const btn = document.getElementById('timerToggleBtn');
    if (btn) {
        btn.innerText = 'Start';
        btn.classList.remove('active');
    }
}

function resetTimer() {
    stopTimer();
    timerTime = currentBaseTime;
    timerIsCountdown = true;
    document.getElementById('fixResultBtn').style.display = 'none';
    updateTimerDisplay();
}

function addTime(seconds) {
    // If we add time, we assume the user wants a countdown (e.g. for rest)
    if (!timerIsCountdown && timerTime === 0) {
        timerIsCountdown = true;
    }

    // If was stopwatch (counting up) and we add time, switching to countdown might be confusing if we don't reset.
    // But typically "add 30s" implies "I want a timer for 30s".
    // Let's simpler logic: always add to current time constant.

    if (!timerIsCountdown && timerTime > 0) {
        // If we were counting up, and user clicks +30s, do we convert to countdown?
        // Or just add 30s to the elapsed time?
        // Usually in workout app, +30s button is for REST timer.
        // So let's force countdown mode.
        timerIsCountdown = true;
    }

    // If switching from stopwatch 0 to countdown, it's fine.
    timerIsCountdown = true;
    timerTime += seconds;
    updateTimerDisplay();
    if (!timerRunning) startTimer();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    document.getElementById('view-workout').style.display = tab === 'workout' ? 'block' : 'none';
    document.getElementById('view-analytics').style.display = tab === 'analytics' ? 'block' : 'none';
    document.getElementById('view-settings').style.display = tab === 'settings' ? 'block' : 'none';

    if (tab === 'settings') {
        document.getElementById('setting-days').value = config.days;
        document.getElementById('setting-sets').value = config.sets;
    }

    if (tab === 'analytics') {
        renderHighLevelAnalytics();
    }
}

function renderHighLevelAnalytics() {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY)) || [];

    if (!stats.length) {
        document.getElementById('stat-workouts').innerText = '0';
        document.getElementById('stat-sets').innerText = '0';
        document.getElementById('stat-time').innerText = '0m';
        // Clear charts if no data
        if (window.histChart && typeof window.histChart.destroy === 'function') window.histChart.destroy();
        if (window.distChart && typeof window.distChart.destroy === 'function') window.distChart.destroy();
        document.getElementById('stats').innerHTML = '<span class="subtitle">Нет данных</span>';
        return;
    }

    // 1. Process Data
    const dates = new Set();
    let totalSeconds = 0;
    const muscleVol = {};
    const dailyVol = {}; // { 'YYYY-MM-DD': seconds }

    stats.forEach(s => {
        const d = new Date(s.ts);
        const dateKey = d.toISOString().split('T')[0];
        dates.add(dateKey);

        totalSeconds += s.reps;

        const m = s.key.split('_')[0];
        muscleVol[m] = (muscleVol[m] || 0) + s.reps;

        dailyVol[dateKey] = (dailyVol[dateKey] || 0) + s.reps;
    });

    // 2. High Level KPIs
    // Count unique columns (Sets) per day, instead of disjoint exercises
    const uniqueSets = new Set(stats.map(s => {
        const parts = s.key.split('_');
        // key is Muscle_Training_Set. Safe to grab indices 1 and 2 as Muscles have no underscores.
        const colKey = `${parts[1]}_${parts[2]}`;
        const d = new Date(s.ts).toISOString().split('T')[0];
        return `${colKey}_${d}`;
    }));

    document.getElementById('stat-workouts').innerText = dates.size;
    document.getElementById('stat-sets').innerText = uniqueSets.size;

    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById('stat-time').innerText = hrs > 0 ? `${hrs}ч ${mins}м` : `${mins} мин`;

    // 3. History Chart
    const sortedDays = Object.keys(dailyVol).sort();
    const dayLabels = sortedDays.map(d => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
    const dayData = sortedDays.map(d => Math.round(dailyVol[d] / 60)); // Minutes

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

    // 4. Distribution Chart
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

    // Render legacy raw stats at the bottom
    renderStats();
}

function renderStats() {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY)) || [];
    const box = document.getElementById('stats');

    if (!stats.length) { box.innerHTML = '<span class="subtitle">Нет данных</span>'; return; }

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

function renderCharts() {
    // Deprecated, logic moved to renderHighLevelAnalytics
    // Kept empty to prevent errors if called
}

function ensureActiveColumn() {
    if (state._activeCol) return state._activeCol;

    // Find first column that is empty (no data entered)
    for (let t of trainings) {
        for (let s of sets) {
            const colKey = `${t}_${s}`;
            // Check if this column has ANY data for ANY muscle
            const hasData = muscles.some(m => {
                const k = keyOf(m, t, s);
                return state[k] && (state[k].reps || state[k].done);
            });

            if (!hasData) {
                state._activeCol = colKey;
                saveData();
                return colKey;
            }
        }
    }

    // If all columns have data, but no active col is set (e.g. finished workout),
    // we can default to 'A_1' to start over, or stay null. 
    // But user wants a highlight. Let's restart at A_1.
    state._activeCol = 'A_1';
    saveData();
    return 'A_1';
}

function autoFillCurrentSet(muscle, value, markDone = false) {
    // Ensure we have a target column
    ensureActiveColumn();

    const activeCol = state._activeCol;
    const [t, s] = activeCol.split('_');
    const key = keyOf(muscle, t, s);

    const cell = state[key] || { reps: '', done: false };

    // Logic: Add to current value
    // Assuming naive number addition for timer integration.
    const currentVal = parseFloat(cell.reps) || 0;
    // If cell was empty, currentVal is 0.

    cell.reps = currentVal + value;

    if (markDone) {
        cell.done = true;

        // Add to stats
        const stats = JSON.parse(localStorage.getItem(STATS_KEY)) || [];
        stats.push({ key, reps: Number(cell.reps) || 0, ts: Date.now() });
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        renderStats();

        if (document.getElementById('view-analytics').style.display !== 'none') {
            renderHighLevelAnalytics();
        }
    }

    state[key] = cell; // Ensure assigned

    saveData();
    render();
}

// Initial setup
// Initial setup
loadState();
ensureActiveColumn();
render();
// Initial tab setup
switchTab('workout');

function adjustSetting(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    input.value = val;
}

function saveSettings() {
    const d = parseInt(document.getElementById('setting-days').value);
    const s = parseInt(document.getElementById('setting-sets').value);

    if (config.days === d && config.sets === s) {
        showToast('Изменений нет');
        return;
    }

    config.days = d;
    config.sets = s;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

    // Update globals
    trainings = ALPHABET.slice(0, config.days).split('');
    sets = Array.from({ length: config.sets }, (_, i) => i + 1);

    render();
    showToast('Настройки сохранены');
}

function getWeekDays(count, offset = 0) {
    // 1: Mon
    // 2: Mon, Thu
    // ...

    const now = new Date();
    // Get Monday of current week
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1) + (offset * 7); // Apply offset here
    const monday = new Date(d.setDate(diff));

    const offsets = [];
    if (count === 1) offsets.push(0);
    else if (count === 2) offsets.push(0, 3); // Mon, Thu
    else if (count === 3) offsets.push(0, 2, 4); // Mon, Wed, Fri
    else if (count === 4) offsets.push(0, 1, 3, 4);
    else {
        for (let i = 0; i < count; i++) offsets.push(i);
    }

    return offsets.map(o => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + o);
        return date;
    });
}

function changeWeek(delta) {
    currentWeekOffset += delta;
    loadState(); // Reload state for the new week
    ensureActiveColumn(); // Ensure we have a valid active column (probably A_1 for new week)
    render();
}

function updateWeekLabel() {
    const start = getWeekMonday(currentWeekOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const opts = { month: 'short', day: 'numeric' };
    let text = `${start.toLocaleDateString('ru-RU', opts)} - ${end.toLocaleDateString('ru-RU', opts)}`;

    if (currentWeekOffset === 0) text += " (Текущая)";

    document.getElementById('weekNavLabel').innerText = text;
}

function getWeekMonday(offset) {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1) + (offset * 7);
    return new Date(d.setDate(diff));
}

function isDateInRange(date, start, end) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return d >= s && d <= e;
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function showToast(msg, isError = false) {
    let toast = document.createElement('div');
    toast.className = isError ? 'toast error' : 'toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    // Trigger reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
