function span(cls, text) {
    return `<span class='${cls}'>${text}</span>`;
}

// MATH MODES: Formulas that drive the visuals
export const MATH_MODES = [
    {
        name: "SPIRAL",
        config: {
            warp: 10.0,
            speed: 60,
            bass: 0.2,
            colors: { c1: 0x00ffff, c2: 0xff00ff }
        },
        verses: [
            [
                [span('m-var', 'float'), span('m-var', 'w'), span('m-op', '='), span('m-var', 'z'), span('m-op', '*'), span('m-num', '0.01')],
                [span('m-var', 'x'), span('m-op', '='), span('m-op', 'fast_sin'), span('m-sep', '('), span('m-var', 'w'), span('m-sep', ')')],
                [span('m-var', 'y'), span('m-op', '='), span('m-op', 'fast_cos'), span('m-sep', '('), span('m-var', 'w'), span('m-sep', ')')]
            ]
        ]
    },
    {
        name: "VELOCITY",
        config: {
            warp: 0.5,
            speed: 250,
            bass: 0.1,
            colors: { c1: 0xff3333, c2: 0xffff00 }
        },
        verses: [
            [
                [span('m-var', 'pos.z'), span('m-op', '+='), span('m-var', 'u_speed'), span('m-op', '*'), span('m-var', 'dt')],
                [span('m-var', 'v'), span('m-op', '='), span('m-op', 'clamp'), span('m-sep', '('), span('m-var', 'accel'), span('m-sep', ')')],
                [span('m-var', 'return'), span('m-sep', ' '), span('m-var', 'v_fast')]
            ]
        ]
    },
    {
        name: "PULSE",
        config: {
            warp: 1.0,
            speed: 20,
            bass: 3.0,
            colors: { c1: 0x00ff00, c2: 0x0000ff }
        },
        verses: [
            [
                [span('m-var', 'p'), span('m-op', '='), span('m-var', 'bass'), span('m-op', '*'), span('m-num', '0.8')],
                [span('m-var', 'scale'), span('m-op', '='), span('m-op', 'mix'), span('m-sep', '('), span('m-num', '1.0'), span('m-sep', ','), span('m-var', 'p'), span('m-sep', ')')],
                [span('m-var', 'out'), span('m-op', '+='), span('m-var', 'scale')]
            ]
        ]
    },
    {
        name: "QUANTUM",
        config: {
            warp: 20.0,
            speed: 5,
            bass: 0.5,
            colors: { c1: 0xffffff, c2: 0x555555 }
        },
        verses: [
            [
                [span('m-var', 'h'), span('m-op', '='), span('m-op', 'fast_hash'), span('m-sep', '('), span('m-var', 'id'), span('m-sep', ')')],
                [span('m-var', 'offset'), span('m-op', '='), span('m-var', 'h'), span('m-op', '>>'), span('m-num', '1')],
                [span('m-var', 'pos'), span('m-op', '^='), span('m-var', 'offset')]
            ]
        ]
    }
];

let lastModeIdx = -1;

export function getRandomMode(evolutionLevel = 1) {
    let idx;
    do {
        idx = Math.floor(Math.random() * MATH_MODES.length);
    } while (idx === lastModeIdx);

    lastModeIdx = idx;

    const baseMode = MATH_MODES[idx];

    // 1. SCALE CONFIG
    const scale = 1.0 + (evolutionLevel - 1) * 0.5;

    const evolvedConfig = {
        ...baseMode.config,
        warp: baseMode.config.warp * scale,
        speed: baseMode.config.speed * scale,
        bass: baseMode.config.bass * (1.0 + (evolutionLevel - 1) * 0.2)
    };

    // 2. EVOLVE FORMULAS
    let evolvedVerses = JSON.parse(JSON.stringify(baseMode.verses)); // Deep clone

    // LEVEL 1: SIMPLE MODE (Truncate to 2 lines)
    if (evolutionLevel === 1) {
        evolvedVerses.forEach((verse, vIdx) => {
            // Keep only the first 2 lines (Definition + Main Equation)
            evolvedVerses[vIdx] = verse.slice(0, 2);
        });
    }

    // LEVEL 4+: COMPLEXITY (Mutation)
    if (evolutionLevel >= 4) {
        // Inject Epsilon or Higher Dims
        evolvedVerses[0].forEach(line => {
            if (line.length > 2 && Math.random() > 0.5) {
                line.push(span('m-op', '+'));
                line.push(span('m-max', 'ε'));
            }
        });
    }

    // LEVEL 6+: CHAOS (Glitch)
    if (evolutionLevel >= 6) {
        evolvedVerses[0].forEach(line => {
            if (Math.random() > 0.7) {
                line.push(span('m-hex', '0x' + Math.floor(Math.random() * 255).toString(16).toUpperCase()));
            }
        });
    }

    return {
        name: baseMode.name,
        config: evolvedConfig,
        verses: evolvedVerses
    };
}
