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

    attribute float aSize;
    attribute float aMix; 
    attribute float aOffset; 

    void main() {
        vUv = uv;
        vMix = aMix;

        vec3 pos = position;
        
        float zPos = mod(pos.z + uTime * uSpeed + aOffset, 1200.0) - 1000.0;
        pos.z = zPos;

        float angle = pos.z * 0.002 * uWarp;
        float s = sin(angle);
        float c = cos(angle);
        float nx = pos.x * c - pos.y * s;
        float ny = pos.x * s + pos.y * c;
        pos.x = nx;
        pos.y = ny;

        float pulse = 1.0 + uBass * 0.3 * smoothstep(-800.0, -100.0, zPos);
        pos.xy *= pulse;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (500.0 / -mvPosition.z) * (1.0 + uBass * 0.5);
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

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
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
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bass = data[4] / 255.0;
        uni.uBass.value += (bass - uni.uBass.value) * 0.3;

        if (bass > 0.7) {
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

