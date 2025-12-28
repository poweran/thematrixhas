import { gameData } from './state.js';
import { TWEEN } from './utils.js';
import { analyser, getBoost, getCurrentPhase, PALETTES } from './audio.js';

const V_SHADER = `
    varying vec2 vUv;
    varying float vMix;
    varying float vAlpha;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uWarp;     
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;

    attribute float aSize;
    attribute float aMix; 
    attribute float aOffset; 

    void main() {
        vUv = uv;
        vMix = aMix;

        vec3 pos = position;
        
        float zPos = mod(pos.z + uTime * uSpeed + aOffset, 1200.0) - 1000.0;
        pos.z = zPos;

        // Normalize Z depth (-1000 to 200) to 0..1 range
        float depthFactor = clamp((zPos + 1000.0) / 1200.0, 0.0, 1.0);
        
        // Non-linear rotation curve: distant objects (low depthFactor) rotate slower
        float rotScale = pow(depthFactor, 3.0);

        // (Redundant block removed)

        float pulse = 1.0 + uBass * 0.8 * smoothstep(-500.0, 200.0, zPos);
        
        // Mid-range warp jitter
        float twist = uWarp * (1.0 + uMid * 0.5);
        
        // Apply twist
        float angle = (pos.z * 0.002 + uTime * 0.1) * rotScale * twist;
        float s = sin(angle);
        float c = cos(angle);
        float nx = pos.x * c - pos.y * s;
        float ny = pos.x * s + pos.y * c;
        pos.x = nx;
        pos.y = ny;

        pos.xy *= pulse;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        // Highs affect particle size brightness/glitter
        gl_PointSize = aSize * (500.0 / -mvPosition.z) * (1.0 + uBass * 0.5 + uHigh * 2.0);
        gl_Position = projectionMatrix * mvPosition;

        vAlpha = smoothstep(-1100.0, -900.0, zPos) * (1.0 - smoothstep(0.0, 200.0, zPos));
    }
`;

const F_SHADER = `
    varying float vMix;
    varying float vAlpha;

    uniform vec3 uColor1;
    uniform vec3 uColor2;

    void main() {
        vec2 uv = gl_PointCoord.xy - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        
        float glow = 1.0 - (dist * 2.0);
        glow = pow(glow, 2.0);
        
        vec3 finalColor = mix(uColor1, uColor2, vMix);
        finalColor += vec3(0.8) * glow; 
        gl_FragColor = vec4(finalColor, vAlpha * glow);
    }
`;

let scene, camera, renderer, tunnelSystem, clock;
let uniforms;
let dataArray;

export function initVisuals() {
    const container = document.getElementById('canvas-container');
    clock = new THREE.Clock();
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.z = 100;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // PARTICLE TUNNEL
    const geo = new THREE.BufferGeometry();
    const count = 10000;
    const pos = [];
    const mixFactors = [];
    const sizes = [];
    const offsets = [];

    const numArms = 3;
    const armSpread = 1.0; // How wide the arms are

    for (let i = 0; i < count; i++) {
        // Create spiral arms
        const armIndex = i % numArms;
        const baseAngle = (armIndex / numArms) * Math.PI * 2;
        // Random offset within the arm (gaussian-ish preference for center of arm would be nice but uniform is okay)
        // Let's use a simpler uniform spread for now
        const angleOffset = (Math.random() - 0.5) * armSpread;
        const angle = baseAngle + angleOffset;

        const r = 30 + Math.random() * 60;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = (Math.random() - 0.5) * 2000;

        pos.push(x, y, z);
        sizes.push(Math.random() * 2 + 1);
        offsets.push(Math.random() * 1000);

        // Randomly assign 0 or 1 for Color1/Color2 mix
        mixFactors.push(Math.random() > 0.5 ? 0.0 : 1.0);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aMix', new THREE.Float32BufferAttribute(mixFactors, 1));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 1));

    uniforms = {
        uTime: { value: 0 },
        uSpeed: { value: 50 },
        uWarp: { value: 1.0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uColor1: { value: new THREE.Color(0x00ffff) },
        uColor2: { value: new THREE.Color(0xff00ff) }
    };

    const mat = new THREE.ShaderMaterial({
        vertexShader: V_SHADER,
        fragmentShader: F_SHADER,
        uniforms: uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    tunnelSystem = new THREE.Points(geo, mat);
    scene.add(tunnelSystem);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle Color Phasing
    window.addEventListener('ns-phase', (e) => {
        const pName = e.detail.name;
        const palette = PALETTES[pName] || PALETTES["INTRO"];

        new TWEEN.Tween(uniforms.uColor1.value)
            .to(new THREE.Color(palette.c1), 1000)
            .start();

        new TWEEN.Tween(uniforms.uColor2.value)
            .to(new THREE.Color(palette.c2), 1000)
            .start();
    });
}

export function animate() {
    requestAnimationFrame(animate);
    if (!clock) return;
    const time = clock.getElapsedTime();
    TWEEN.update(performance.now());

    let targetSpeed = 50 + (gameData.cycle * 10);
    let targetWarp = 1.0 + (gameData.cycle * 0.5);
    const boosting = getBoost();

    if (boosting) {
        targetSpeed *= 4;
        targetWarp += 5.0;
    }

    const uni = tunnelSystem.material.uniforms;
    uni.uTime.value = time;
    uni.uSpeed.value += (targetSpeed - uni.uSpeed.value) * 0.05;
    uni.uWarp.value += (targetWarp - uni.uWarp.value) * 0.05;

    if (analyser) {
        if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataArray);

        // Extract bands
        let b = 0, m = 0, h = 0;
        // Bins 0-2 (Bass)
        for (let i = 0; i < 3; i++) b += dataArray[i];
        // Bins 3-12 (Mid)
        for (let i = 3; i < 12; i++) m += dataArray[i];
        // Bins 13-32 (High)
        for (let i = 12; i < 32; i++) h += dataArray[i];

        b /= 3; m /= 9; h /= 20;

        const bassVal = b / 255.0;
        const midVal = m / 255.0;
        const highVal = h / 255.0;

        uni.uBass.value += (bassVal - uni.uBass.value) * 0.2;
        uni.uMid.value += (midVal - uni.uMid.value) * 0.2;
        uni.uHigh.value += (highVal - uni.uHigh.value) * 0.2;

        if (bassVal > 0.6) {
            camera.position.x = (Math.random() - 0.5) * 0.5;
            camera.position.y = (Math.random() - 0.5) * 0.5;
        }
    }

    // Update HUD Energy
    const elEnergy = document.getElementById('energyVal');
    if (elEnergy) elEnergy.innerText = Math.floor(uni.uSpeed.value / 10) + "%";

    camera.rotation.z = Math.sin(time * 0.1) * 0.1;
    renderer.render(scene, camera);
}

