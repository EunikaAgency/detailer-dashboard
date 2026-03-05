/**
 * Import a MongoDB backup using mongorestore.
 *
 * Usage:
 *   npm run import-db:staging
 *   npm run import-db:live
 *   npm run import-db:staging -- /absolute/or/relative/backup/path
 *
 * Default source:
 *   latest folder in web/backups/db that matches "<target>-*"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const target = String(process.argv[2] || '').trim().toLowerCase();
const backupArg = process.argv[3] ? String(process.argv[3]).trim() : '';

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

const commandCheck = spawnSync('mongorestore', ['--version'], { stdio: 'ignore' });
if (commandCheck.error || commandCheck.status !== 0) {
  console.error('Error: mongorestore is not available in PATH.');
  console.error('Install MongoDB Database Tools, then try again.');
  process.exit(1);
}

const backupRoot = path.join(__dirname, '..', 'backups', 'db');

function resolveLatestBackupDir() {
  if (!fs.existsSync(backupRoot)) {
    return null;
  }

  const prefix = `${target}-`;
  const entries = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    return null;
  }

  return path.join(backupRoot, entries[entries.length - 1]);
}

function resolveRestoreDir(baseDir) {
  const absoluteBase = path.resolve(baseDir);

  if (!fs.existsSync(absoluteBase) || !fs.statSync(absoluteBase).isDirectory()) {
    throw new Error(`Backup directory not found: ${absoluteBase}`);
  }

  const rootFiles = fs.readdirSync(absoluteBase);
  const hasDumpFilesAtRoot = rootFiles.some((name) => name.endsWith('.bson') || name.endsWith('.bson.gz'));

  if (hasDumpFilesAtRoot) {
    return absoluteBase;
  }

  const childDirs = fs.readdirSync(absoluteBase, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteBase, entry.name));

  for (const child of childDirs) {
    const childFiles = fs.readdirSync(child);
    const hasDumpFiles = childFiles.some((name) => name.endsWith('.bson') || name.endsWith('.bson.gz'));
    if (hasDumpFiles) {
      return child;
    }
  }

  throw new Error(`No BSON dump files found in: ${absoluteBase}`);
}

async function askConfirmation(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => rl.question(promptText, resolve));
  rl.close();
  return String(answer || '').trim().toUpperCase() === 'YES';
}

async function run() {
  const selectedBackupDir = backupArg
    ? path.resolve(process.cwd(), backupArg)
    : resolveLatestBackupDir();

  if (!selectedBackupDir) {
    console.error(`Error: no backups found for target "${target}" in ${backupRoot}`);
    process.exit(1);
  }

  let restoreDir;
  try {
    restoreDir = resolveRestoreDir(selectedBackupDir);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  console.log(`Import target: ${target}`);
  console.log(`URI: ${mongoUri}`);
  console.log(`Backup folder: ${selectedBackupDir}`);
  console.log(`Restore dir: ${restoreDir}`);
  console.log('\nWARNING: This will drop and replace existing collections in the target database.\n');

  const confirmed = await askConfirmation('Type "YES" to continue: ');
  if (!confirmed) {
    console.log('Import cancelled.');
    process.exit(0);
  }

  const restore = spawnSync(
    'mongorestore',
    [`--uri=${mongoUri}`, '--drop', '--gzip', `--dir=${restoreDir}`],
    { stdio: 'inherit' }
  );

  if (restore.error) {
    console.error(`Import failed: ${restore.error.message}`);
    process.exit(1);
  }

  if (typeof restore.status === 'number' && restore.status !== 0) {
    console.error(`Import failed with exit code ${restore.status}.`);
    process.exit(restore.status);
  }

  console.log('Import complete.');
}

run();
