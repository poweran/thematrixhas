export const audio = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    },

    playSound(freq, duration, type, vol = 1) {
        const ctx = this.init();
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
};

export const zapper = {
    active: false,
    nodes: [],
    analyser: null,
    dataArray: null,
    animationId: null,
    audioStartTime: 0,
    sweepRanges: [[77000, 400000], [350000, 500000], [500000, 900000]],

    toggle() {
        if (this.active) this.stop();
        else this.start();
        this.updateUI();
    },

    start() {
        const ctx = audio.init();
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
            const basePhase = (t * 4 - timeScale) * Math.PI * 2;
            y += Math.sign(Math.sin(basePhase)) * 0.4;

            // 2. Add Sweeps (Visualized as higher freq sines/noise)
            for (let i = 1; i < 4; i++) {
                // Ratio relative to 30k
                const ratio = freqs[i] / 30000;
                // Visual freq
                const vf = 4 * ratio;
                const amp = 0.15; // lower amplitude for sweeps
                y += Math.sin((t * vf - timeScale * ratio) * Math.PI * 2) * amp;
            }

            // Map -1..1 to Height
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
