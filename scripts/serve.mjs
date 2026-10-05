// Zero-dependency static file server for local development.
// With --watch it also runs `tsc --watch` and reloads open pages when files change.
import { spawn } from 'node:child_process';
import { mkdirSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8731);
const HOST = process.env.HOST || '127.0.0.1';
const WATCH = process.argv.includes('--watch');
const RELOAD_PATH = '/__reload';

// Injected into served HTML in watch mode. A stylesheet change swaps the sheet in place; anything
// else reloads the page (the game saves on unload, so a reload resumes where it was).
const RELOAD_CLIENT = `<script>
(() => {
  const source = new EventSource('${RELOAD_PATH}');
  let dropped = false;
  source.addEventListener('reload', () => location.reload());
  source.addEventListener('css', () => {
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const url = new URL(link.href);
      url.searchParams.set('v', Date.now());
      link.href = url.href;
    }
  });
  source.addEventListener('error', () => { dropped = true; });
  source.addEventListener('open', () => { if (dropped) location.reload(); });
})();
</script>`;

const clients = new Set();
let pending = null;
let timer = null;

function notify(kind) {
  if (kind === 'reload' || pending === null) pending = kind;
  clearTimeout(timer);
  // tsc writes its outputs one file at a time; wait for the burst to finish.
  timer = setTimeout(() => {
    for (const res of clients) res.write(`event: ${pending}\ndata: 1\n\n`);
    pending = null;
  }, 100);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const full = normalize(join(ROOT, decoded));
  if (!full.startsWith(ROOT)) return null;
  try {
    const s = await stat(full);
    if (s.isDirectory()) return join(full, 'index.html');
    return full;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (WATCH && req.url === RELOAD_PATH) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = await resolveFile(req.url || '/');
  const headers = { 'Cache-Control': 'no-store' };
  if (!file) {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  try {
    let body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    if (WATCH && extname(file).toLowerCase() === '.html') {
      body = body.toString('utf8').replace('</body>', `${RELOAD_CLIENT}\n</body>`);
    }
    res.writeHead(200, { ...headers, 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Takeoff dev server: http://${HOST}:${PORT}/`);
});

if (WATCH) {
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  watch(dist, { recursive: true }, (_event, name) => {
    if (name && name.endsWith('.js')) notify('reload');
  });
  watch(ROOT, (_event, name) => {
    if (name === 'styles.css') notify('css');
    else if (name === 'index.html') notify('reload');
  });

  const tsc = spawn(
    process.execPath,
    [join(ROOT, 'node_modules/typescript/bin/tsc'), '--watch', '--preserveWatchOutput'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  const stop = () => {
    tsc.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
