// Generates public/firebase-messaging-sw.js from the template using
// VITE_FIREBASE_* env vars. The output file is gitignored (never committed).
// Real environment variables take precedence (CI); falls back to .env file.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'public', 'firebase-messaging-sw.template.js');
const outPath = path.join(root, 'public', 'firebase-messaging-sw.js');

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const fileVars = loadDotEnv();
const get = (k) => process.env[k] || fileVars[k] || '';

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missing = required.filter((k) => !get(k));
if (missing.length > 0) {
  console.error(`[generate-sw] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf8');
for (const key of required) {
  template = template.split(`__${key}__`).join(get(key));
}

if (template.includes('__VITE_')) {
  console.error('[generate-sw] Unreplaced placeholders remain. Aborting.');
  process.exit(1);
}

fs.writeFileSync(outPath, template);
console.log('[generate-sw] Wrote public/firebase-messaging-sw.js');
