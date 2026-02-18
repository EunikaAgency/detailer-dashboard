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
   mongodump --uri="mongodb://localhost:27017/otsuka_prod" --out=/path/to/backup
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
- `sync-staging-to-live-preview.js` - Sync preview (dry run)
- `check-users.js` - User listing
- `conversion-cron.js` - File conversion cron job
