const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const cases = [
  { name: 'hanging queen', fen: '4r2k/8/8/8/4Q3/8/8/K7 b - - 0 1', bestMove: 'e8e4' },
  { name: 'mate in one', fen: '7k/6pp/5p2/8/8/5Q2/6PP/6K1 w - - 0 1', bestMove: 'f3a8' },
  { name: 'hanging rook', fen: '8/k7/8/4r3/4Q3/8/8/K7 w - - 0 1', bestMove: 'e4e5' },
];

function waitForOutput(output, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function poll() {
      const index = output.findIndex(predicate);
      if (index >= 0) { resolve(output.splice(0, index + 1).at(-1)); return; }
      if (Date.now() >= deadline) { reject(new Error(`Stockfish UCI response timed out. Output: ${output.join(' | ')}`)); return; }
      setTimeout(poll, 10);
    }
    poll();
  });
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stockfish-check-'));
  try {
    const sourceDir = path.resolve('public/stockfish');
    const scriptName = 'stockfish-19-lite-single.js';
    const wasmName = 'stockfish-19-lite-single.wasm';
    const scriptPath = path.join(tempDir, scriptName);
    fs.copyFileSync(path.join(sourceDir, scriptName), scriptPath);
    fs.copyFileSync(path.join(sourceDir, wasmName), path.join(tempDir, wasmName));

    // Execute Stockfish's actual browser-worker branch: no Node process/require is exposed to the VM.
    const output = [];
    const location = {
      href: `https://games.test/stockfish/${scriptName}`,
      origin: 'https://games.test',
      pathname: `/stockfish/${scriptName}`,
      hash: '',
    };
    const sandbox = {
      location,
      URL, URLSearchParams, Response, Headers, ReadableStream,
      TextDecoder, TextEncoder, WebAssembly, Uint8Array, Int8Array, Int16Array,
      Int32Array, Uint32Array, Float64Array, BigInt64Array, ArrayBuffer, SharedArrayBuffer,
      Promise, Date, Math, Number, String, Boolean, Object, Array, Map, Set, Symbol,
      Error, TypeError, JSON, RegExp, console, performance, setTimeout, clearTimeout,
      setInterval, clearInterval, onmessage: null,
      postMessage: message => output.push(String(message)),
      close: () => {},
      fetch: async input => {
        const url = new URL(String(input), location.href);
        const filePath = path.join(tempDir, path.basename(url.pathname));
        const bytes = fs.readFileSync(filePath);
        return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
      },
    };
    sandbox.self = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });
    if (typeof context.onmessage !== 'function') throw new Error('Stockfish did not initialize its worker message handler');
    const send = command => context.onmessage({ data: command });

    for (const testCase of cases) {
      send('uci');
      await waitForOutput(output, line => line === 'uciok');
      send('isready');
      await waitForOutput(output, line => line === 'readyok');
      send('setoption name Skill Level value 20');
      send(`position fen ${testCase.fen}`);
      send('go depth 8');
      const response = await waitForOutput(output, line => line.startsWith('bestmove '));
      const actualMove = response.split(/\s+/)[1];
      if (actualMove !== testCase.bestMove) {
        throw new Error(`Stockfish missed ${testCase.name}: expected ${testCase.bestMove}, got ${response}`);
      }
      send('ucinewgame');
    }
    console.log(`Stockfish 19 Lite browser-worker test passed: ${cases.length} tactical regressions.`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
