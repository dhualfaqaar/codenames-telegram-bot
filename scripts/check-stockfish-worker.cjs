const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

if (isMainThread) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stockfish-check-'));
  const sourceDir = path.resolve('public/stockfish');
  fs.copyFileSync(path.join(sourceDir, 'stockfish.wasm.js'), path.join(tempDir, 'stockfish.wasm.js'));
  fs.copyFileSync(path.join(sourceDir, 'stockfish.wasm'), path.join(tempDir, 'stockfish.wasm'));
  const engineScript = path.join(tempDir, 'stockfish.wasm.js');
  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true });
  const worker = new Worker(__filename, { workerData: engineScript });
  let phase = 'uci';
  const timer = setTimeout(() => {
    console.error('Stockfish UCI test timed out');
    worker.terminate();
    cleanup();
    process.exitCode = 1;
  }, 15_000);
  worker.on('message', message => {
    const line = String(message).trim();
    if (phase === 'uci' && line === 'uciok') {
      phase = 'ready';
      worker.postMessage('isready');
    } else if (phase === 'ready' && line === 'readyok') {
      phase = 'search';
      worker.postMessage('setoption name Skill Level value 20');
      worker.postMessage('position fen 4r2k/8/8/8/4Q3/8/8/K7 b - - 0 1');
      worker.postMessage('go depth 8');
    } else if (phase === 'search' && line.startsWith('bestmove ')) {
      clearTimeout(timer);
      worker.terminate();
      cleanup();
      const move = line.split(/\s+/)[1];
      if (move !== 'e8e4') {
        console.error(`Stockfish missed the hanging-queen regression: ${line}`);
        process.exitCode = 1;
      } else {
        console.log('Stockfish WASM UCI test passed: selected the hanging-queen capture.');
      }
    }
  });
  worker.on('error', error => {
    clearTimeout(timer);
    cleanup();
    console.error(error);
    process.exitCode = 1;
  });
  worker.postMessage('uci');
} else {
  globalThis.self = globalThis;
  globalThis.location = { href: pathToFileURL(workerData).href };
  globalThis.importScripts = function () {};
  globalThis.postMessage = message => parentPort.postMessage(String(message));
  globalThis.close = () => process.exit(0);
  globalThis.fetch = async url => {
    const file = path.resolve(path.dirname(workerData), String(url));
    const bytes = fs.readFileSync(file);
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
  };
  class XMLHttpRequestMock {
    open(method, url, async = true) { this.url = url; this.async = async; }
    send() {
      try {
        const file = path.resolve(path.dirname(workerData), String(this.url));
        const bytes = fs.readFileSync(file);
        this.status = 200;
        if (this.responseType === 'arraybuffer') this.response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        else this.responseText = bytes.toString();
        if (this.onload) queueMicrotask(() => this.onload());
      } catch (error) { this.status = 404; this.onerror?.(error); }
    }
  }
  globalThis.XMLHttpRequest = XMLHttpRequestMock;
  Object.defineProperty(globalThis, 'onmessage', {
    configurable: true,
    set(handler) { parentPort.on('message', data => handler({ data })); },
    get() { return undefined; },
  });
  require(workerData);
}
