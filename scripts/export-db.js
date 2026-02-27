/**
 * Export a MongoDB database using mongodump.
 *
 * Usage:
 *   npm run export-db:staging
 *   npm run export-db:live
 *
 * Output:
 *   web/backups/db/<target>-<timestamp>/
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const target = String(process.argv[2] || '').trim().toLowerCase();

if (target !== 'staging' && target !== 'live') {
  console.error('Error: target must be "staging" or "live".');
  process.exit(1);
}

const envFile = target === 'staging' ? '.env.development' : '.env.production';
const envPath = path.join(__dirname, '..', envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: ${envFile} not found at ${envPath}`);
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));
const mongoUri = env.MONGO_URI || '';

if (!mongoUri) {
  console.error(`Error: MONGO_URI is missing in ${envFile}`);
  process.exit(1);
}

const commandCheck = spawnSync('mongodump', ['--version'], { stdio: 'ignore' });
if (commandCheck.error || commandCheck.status !== 0) {
  console.error('Error: mongodump is not available in PATH.');
  console.error('Install MongoDB Database Tools, then try again.');
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:]/g, '-')
  .replace(/\..+$/, '')
  .replace('T', '_');

const backupRoot = path.join(__dirname, '..', 'backups', 'db');
const outDir = path.join(backupRoot, `${target}-${timestamp}`);
fs.mkdirSync(outDir, { recursive: true });

console.log(`Exporting ${target} database...`);
console.log(`URI: ${mongoUri}`);
console.log(`Output directory: ${outDir}`);

const dump = spawnSync(
  'mongodump',
  [`--uri=${mongoUri}`, `--out=${outDir}`, '--gzip'],
  { stdio: 'inherit' }
);

if (dump.error) {
  console.error(`Export failed: ${dump.error.message}`);
  process.exit(1);
}

if (typeof dump.status === 'number' && dump.status !== 0) {
  console.error(`Export failed with exit code ${dump.status}.`);
  process.exit(dump.status);
}

console.log('Export complete.');
