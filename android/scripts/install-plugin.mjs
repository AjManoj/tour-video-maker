// Run after `npx cap add android`. Idempotent: safe to run more than once.
// 1. Copies plugin/*.kt into the generated app package
// 2. Registers TourNativePlugin in MainActivity
// 3. Adds Kotlin support + Media3 / ML Kit dependencies to Gradle
// 4. Adds INTERNET permission + network security config (LAN http) to the manifest
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const native = join(root, cfg.android?.path || 'android');
const appDir = join(native, 'app');
const pkgPath = cfg.appId.split('.');
const javaDir = join(appDir, 'src', 'main', 'java', ...pkgPath);
const resXml = join(appDir, 'src', 'main', 'res', 'xml');
const manifestPath = join(appDir, 'src', 'main', 'AndroidManifest.xml');

const KOTLIN_VERSION = '2.0.21';
const MEDIA3_VERSION = '1.5.1';
const MLKIT_FACE_VERSION = '16.1.7';

if (!existsSync(appDir)) {
  console.error(`install-plugin: ${appDir} not found. Run "npx cap add android" first.`);
  process.exit(1);
}
const log = (m) => console.log('install-plugin: ' + m);
const read = (p) => readFileSync(p, 'utf8');

// 1. Kotlin sources
mkdirSync(javaDir, { recursive: true });
for (const f of readdirSync(join(root, 'plugin')).filter((f) => f.endsWith('.kt'))) {
  const src = read(join(root, 'plugin', f)).replace(/^package .*$/m, `package ${cfg.appId}`);
  writeFileSync(join(javaDir, f), src);
  log(`copied ${f}`);
}
mkdirSync(resXml, { recursive: true });
cpSync(join(root, 'plugin', 'res', 'xml', 'network_security_config.xml'), join(resXml, 'network_security_config.xml'));
log('copied network_security_config.xml');

// 2. Register plugin in MainActivity (.java from the Capacitor template, or .kt)
const mainJava = join(javaDir, 'MainActivity.java');
const mainKt = join(javaDir, 'MainActivity.kt');
if (existsSync(mainJava)) {
  let s = read(mainJava);
  if (!s.includes('TourNativePlugin')) {
    if (!s.includes('import android.os.Bundle;')) s = s.replace(/(package [^;]+;\s*)/, '$1\nimport android.os.Bundle;\n');
    if (/void onCreate\(/.test(s)) {
      s = s.replace(/(super\.onCreate\([^)]*\);)/, 'registerPlugin(TourNativePlugin.class);\n        $1');
    } else {
      s = s.replace(/(extends BridgeActivity\s*\{)/, `$1
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TourNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
`);
    }
    writeFileSync(mainJava, s);
    log('registered plugin in MainActivity.java');
  } else log('MainActivity.java already registers the plugin');
} else if (existsSync(mainKt)) {
  let s = read(mainKt);
  if (!s.includes('TourNativePlugin')) {
    s = s.replace(/(class MainActivity\s*:\s*BridgeActivity\(\)\s*\{?)/, (m) => (m.endsWith('{') ? m : m + ' {') + `
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(TourNativePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
` + (m.endsWith('{') ? '' : '}'));
    writeFileSync(mainKt, s);
    log('registered plugin in MainActivity.kt');
  }
} else {
  console.warn('install-plugin: MainActivity not found; register TourNativePlugin manually.');
}

// 3a. Kotlin Gradle plugin in the root build.gradle
const rootGradle = join(native, 'build.gradle');
if (existsSync(rootGradle)) {
  let s = read(rootGradle);
  if (!s.includes('kotlin-gradle-plugin')) {
    s = s.replace(/(buildscript\s*\{[\s\S]*?dependencies\s*\{)/, `$1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}'`);
    writeFileSync(rootGradle, s);
    log('added kotlin-gradle-plugin to root build.gradle');
  }
}

// 3b. App build.gradle: apply kotlin-android, jvmTarget, dependencies
const appGradle = join(appDir, 'build.gradle');
let g = read(appGradle);
if (!g.includes("'kotlin-android'") && !g.includes('org.jetbrains.kotlin.android')) {
  g = g.replace(/(apply plugin: 'com\.android\.application')/, `$1\napply plugin: 'kotlin-android'`);
  log('applied kotlin-android');
}
// Match Kotlin's JVM target to the Java version Capacitor configured (21 for Capacitor 7).
let javaVer = '21';
const capGradle = join(appDir, 'capacitor.build.gradle');
if (existsSync(capGradle)) {
  const m = read(capGradle).match(/JavaVersion\.VERSION_(\d+)/);
  if (m) javaVer = m[1];
}
if (!g.includes('kotlinOptions')) {
  g += `\nandroid {\n    kotlinOptions {\n        jvmTarget = '${javaVer}'\n    }\n}\n`;
  log(`set kotlin jvmTarget ${javaVer}`);
}
const deps = [
  `implementation "androidx.media3:media3-transformer:${MEDIA3_VERSION}"`,
  `implementation "androidx.media3:media3-effect:${MEDIA3_VERSION}"`,
  `implementation "androidx.media3:media3-common:${MEDIA3_VERSION}"`,
  `implementation "com.google.mlkit:face-detection:${MLKIT_FACE_VERSION}"`,
];
const missing = deps.filter((d) => !g.includes(d.split(':').slice(0, 2).join(':').split('"')[1]));
if (missing.length) {
  g = g.replace(/(\ndependencies\s*\{)/, `$1\n    // Day Tour Video Maker native plugin\n    ${missing.join('\n    ')}`);
  log(`added ${missing.length} dependencies`);
}
writeFileSync(appGradle, g);

// 4. Manifest: INTERNET permission + network security config
let mf = read(manifestPath);
if (!mf.includes('android.permission.INTERNET')) {
  mf = mf.replace(/(<manifest[^>]*>)/, '$1\n    <uses-permission android:name="android.permission.INTERNET" />');
  log('added INTERNET permission');
}
if (!mf.includes('networkSecurityConfig')) {
  mf = mf.replace(/<application\b/, '<application\n        android:networkSecurityConfig="@xml/network_security_config"\n        android:usesCleartextTraffic="true"');
  log('added network security config');
}
writeFileSync(manifestPath, mf);
log('done. Next: npm run sync && npm run build:apk');
