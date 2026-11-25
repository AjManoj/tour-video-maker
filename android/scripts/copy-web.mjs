// Copies ../web into ./www (Capacitor webDir). Cross-platform, no dependencies.
import { cpSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, '..', 'web');
const dst = join(root, 'www');

if (!existsSync(join(src, 'index.html'))) {
  console.error(`copy-web: ${src}/index.html not found`);
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
// Mark the runtime so config.js can tell it is inside the APK even before Capacitor loads.
writeFileSync(join(dst, 'runtime.json'), JSON.stringify({ runtime: 'apk' }) + '\n');
console.log(`copy-web: ${src} -> ${dst}`);
