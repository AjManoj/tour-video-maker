// Runs gradlew assembleDebug inside the generated native project.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const nativeDir = join(root, cfg.android?.path || 'android');
if (!existsSync(nativeDir)) {
  console.error(`build-apk: ${nativeDir} missing. Run "npm run add" first.`);
  process.exit(1);
}
const win = process.platform === 'win32';
const gradlew = join(nativeDir, win ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(gradlew, ['assembleDebug'], { cwd: nativeDir, stdio: 'inherit', shell: win });
if (r.status === 0) {
  console.log(`\nAPK: ${join(nativeDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`);
}
process.exit(r.status ?? 1);
