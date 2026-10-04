// Assemble the static site while preserving the browser's dist/main.js URL.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('public/', root);

rmSync(fileURLToPath(output), { recursive: true, force: true });
mkdirSync(fileURLToPath(output), { recursive: true });
for (const file of ['index.html', 'styles.css', 'dist']) {
  cpSync(fileURLToPath(new URL(file, root)), fileURLToPath(new URL(file, output)), {
    recursive: true,
  });
}
