# Database Management Scripts

This directory contains utility scripts for managing the Otsuka Detailer databases.

## Available Scripts

### 1. Reset Admin User

**Purpose:** Wipe all users and create a fresh admin account.

**Commands:**
```bash
# For development (otsuka_dev)
npm run reset-admin

# For production (otsuka_prod)
npm run reset-admin:prod
```

**Admin Credentials:**
- Name: Eunika
- Email: info@eunika.agency
- Password: justinianthegreat!

**What it does:**
- Deletes all existing users from the database
- Creates a new admin user with the credentials above
- Generates a keygen token automatically

---

### 2. Sync Staging to Live

**Purpose:** Copy all data from staging database to live database.

**⚠️ WARNING:** This completely replaces all data in the production database!

**Commands:**
```bash
# Preview what would be synced (safe, no changes)
npm run sync-db:preview

# Perform actual sync (DANGEROUS - requires confirmation)
npm run sync-db
```

**What it does:**
- Connects to both otsuka_dev (staging) and otsuka_prod (live)
- Drops all collections in live database
- Copies all documents from staging to live
- Recreates all indexes
- Syncs these collections:
  - users
  - doctors
  - appointments
  - products
  - presentations

**Safety Features:**
- Preview mode to see what would change
- Requires typing "YES" to confirm
- Shows detailed progress during sync
- Maintains data integrity with indexes

---

### 3. Check Users

**Purpose:** View all users in the database.

**Command:**
```bash
node scripts/check-users.js
```

**What it shows:**
- User ID
- Name
- Email
- Whether they have a keygen

---

### 4. Export Database Backup

**Purpose:** Create a `mongodump` backup for staging or live.

**Commands:**
```bash
# Export staging database (otsuka_dev)
npm run export-db:staging

# Export live database (otsuka_prod)
npm run export-db:live
```

**Output:**
- Backups are written to `web/backups/db/<target>-<timestamp>/`
- Uses `mongodump --gzip`

---

### 5. Import Database Backup

**Purpose:** Restore a database from a `mongodump` backup.

**Commands:**
```bash
# Import latest staging backup into staging database (otsuka_dev)
npm run import-db:staging

# Import latest live backup into live database (otsuka_prod)
npm run import-db:live

# Import from a specific backup folder
npm run import-db:staging -- backups/db/staging-2026-03-05_04-18-19
```

**What it does:**
- Loads target DB URI from `.env.development` or `.env.production`
- Selects latest matching backup by default (`backups/db/<target>-*`)
- Runs `mongorestore --drop --gzip`
- Requires typing `YES` before restore

---

## Database Configuration

The scripts automatically detect and use the correct database based on environment:

- **Development:** `otsuka_dev` (from `.env.development`)
- **Production:** `otsuka_prod` (from `.env.production`)

## Best Practices

1. **Always preview before syncing:**
   ```bash
   npm run sync-db:preview
   ```

2. **Backup production before major changes:**
   ```bash
   npm run export-db:live
   ```

3. **Test in development first:**
   - Make changes in staging (otsuka_dev)
   - Verify everything works
   - Then sync to live (otsuka_prod)

4. **Use reset-admin carefully:**
   - This deletes ALL users
   - Only use when you need a clean slate
   - Typically used for initial setup or troubleshooting

## Example Workflow

**Setting up a fresh production environment:**

```bash
# 1. Preview current state
npm run sync-db:preview

# 2. Sync staging to live
npm run sync-db
# Type "YES" when prompted

# 3. Verify the sync
node scripts/check-users.js

# 4. If needed, reset admin credentials
npm run reset-admin:prod
```

**Troubleshooting authentication:**

```bash
# Reset admin user in development
npm run reset-admin

# Reset admin user in production
npm run reset-admin:prod
```

## Error Handling

All scripts include:
- Connection validation
- Detailed error messages
- Proper connection cleanup
- Safe exit on errors

## Technical Details

**Dependencies:**
- `mongoose` - MongoDB driver
- `bcryptjs` - Password hashing
- `jsonwebtoken` - Token generation
- `dotenv` - Environment variables

**Files:**
- `reset-admin.js` - Admin user reset
- `sync-staging-to-live.js` - Database sync
- `sync-live-to-staging.js` - Reverse database sync
- `sync-staging-to-live-preview.js` - Sync preview (dry run)
- `export-db.js` - Database export using mongodump
- `check-users.js` - User listing
- `conversion-cron.js` - File conversion cron job

---

### 6. Daily Server Security Audit Report

**Purpose:** Generate a passive daily audit report for the Ubuntu production server.

**Command:**
```bash
bash scripts/security-audit-report.sh --config /etc/server-audit-report.conf
```

**What it does:**
- Collects a last-24-hour security and change summary
- Stores a dated machine-readable snapshot for comparisons
- Compares today with the previous snapshot and recent 5-day history
- Writes a human-readable plain text report

**Important:**
- Reporting only
- No blocking, deleting, restarting, or remediation by default
- Intended to run as `root` from cron for complete visibility

**Docs:**
- `scripts/SECURITY_AUDIT.md`
- `scripts/security-audit.conf.example`

---

### 7. Daily Products API Backup

**Purpose:** Save a git-friendly daily snapshot of the live `GET /api/products` response.

**Commands:**
```bash
# Run one backup immediately
npm run backup:products-api
```

**What it does:**
- fetches the live API response from `http://127.0.0.1:7001/api/products`
- writes a pretty JSON snapshot under `backups/api-products/YYYY/YYYY-MM-DD.json`
- refreshes `backups/api-products/latest.json`
- stores a SHA-256 checksum of the raw response

**PM2 process:**
- `detailer-products-api-backup`

**Notes:**
- the worker runs hourly but only writes one snapshot per calendar day
- snapshots are plain JSON and intended to be easy to diff and commit to git
