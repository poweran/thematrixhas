// Math Token Generators
// Structure: Returns [ [token, token...], [token, token...] ] mimicking lines/syllables

function span(cls, text) {
    return `<span class='${cls}'>${text}</span>`;
}

// 1. SEQUENCE GENERATOR (Fibonacci/Primes)
function genSequence(type) {
    let seq = [];
    if (type === 'fib') {
        let a = 1, b = 1;
        seq.push(span('m-num', a));
        seq.push(span('m-num', b));
        for (let i = 0; i < 6; i++) {
            let next = a + b;
            seq.push(span('m-num', next));
            a = b; b = next;
        }
    } else { // Primes
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
        seq = primes.map(p => span('m-num', p));
    }

    // Format as 1 token per line for vertical stack, or chunks?
    // Let's make it a single "verse" of 4 lines
    return [
        seq.slice(0, 2),
        seq.slice(2, 4),
        seq.slice(4, 6),
        seq.slice(6, 8)
    ];
}

// 2. EQUATION GENERATOR
function genEquation() {
    // Riemann / Euler
    return [
        [span('m-var', 'e'), span('m-op', '^'), span('m-sep', '('), span('m-const', 'i'), span('m-op', '·'), span('m-const', 'π'), span('m-sep', ')')],
        [span('m-op', '+'), span('m-num', '1')],
        [span('m-op', '='), span('m-num', '0')],
        [span('m-def', '// Euler')]
    ];
}

// 3. CHAOS GENERATOR (Hex/Binary Stream)
function genChaos() {
    const lines = [];
    for (let i = 0; i < 4; i++) {
        const line = [];
        for (let j = 0; j < 4; j++) {
            if (Math.random() > 0.5) {
                // Hex
                const hex = Math.floor(Math.random() * 255).toString(16).toUpperCase().padStart(2, '0');
                line.push(span('m-hex', '0x' + hex));
            } else {
                // Binary
                const bin = Math.floor(Math.random() * 255).toString(2).padStart(8, '0');
                line.push(span('m-bin', bin.substring(0, 4)));
            }
        }
        lines.push(line);
    }
    return lines;
}

// 4. CALCULUS STREAM
function genCalculus() {
    return [
        [span('m-op', '∫'), span('m-var', 'f(x)'), span('m-var', 'dx')],
        [span('m-op', '='), span('m-var', 'lim'), span('m-sep', '→'), span('m-const', '∞')],
        [span('m-op', '∑'), span('m-var', 'i'), span('m-op', '='), span('m-num', '0')],
        [span('m-var', 'Δx'), span('m-op', '·'), span('m-var', 'y')]
    ];
}

let lastType = -1;

export function getRandomVerse() {
    const types = [genSequence, genEquation, genChaos, genCalculus];
    let idx;
    do {
        idx = Math.floor(Math.random() * types.length);
    } while (idx === lastType);
    lastType = idx;

    const generator = types[idx];
    // Pass args if needed (e.g. sequence type)
    if (generator === genSequence) {
        return generator(Math.random() > 0.5 ? 'fib' : 'primes');
    }
    return generator();
}
