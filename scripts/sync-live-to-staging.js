/**
 * Sync Live to Staging Database
 *
 * This script copies ALL data from live (otsuka_prod) to staging (otsuka_dev).
 * ⚠️  WARNING: This will COMPLETELY REPLACE all data in the staging database!
 *
 * Usage:
 *   npm run sync-db:live-to-staging
 *
 * The script will:
 * 1. Connect to both live and staging databases
 * 2. Drop all collections in staging database
 * 3. Copy all documents from live to staging
 * 4. Maintain indexes and relationships
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load environment variables
const devEnvPath = path.join(__dirname, '..', '.env.development');
const prodEnvPath = path.join(__dirname, '..', '.env.production');

if (!fs.existsSync(devEnvPath) || !fs.existsSync(prodEnvPath)) {
  console.error('❌ Error: .env.development or .env.production not found');
  process.exit(1);
}

const dotenv = require('dotenv');
const devEnv = dotenv.parse(fs.readFileSync(devEnvPath));
const prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));

const STAGING_URI = devEnv.MONGO_URI || 'mongodb://localhost:27017/otsuka_dev';
const LIVE_URI = prodEnv.MONGO_URI || 'mongodb://localhost:27017/otsuka_prod';

const getUserCollections = async (conn) => {
  const collections = await conn.db.listCollections({}, { nameOnly: true }).toArray();
  return collections
    .map((entry) => entry.name)
    .filter((name) => typeof name === 'string' && !name.startsWith('system.'));
};

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function syncDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         SYNC LIVE TO STAGING DATABASE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Configuration:');
  console.log(`   Live:    ${LIVE_URI}`);
  console.log(`   Staging: ${STAGING_URI}`);
  console.log('   Collections: auto-detected from LIVE source database\n');

  console.log('⚠️  WARNING: This will completely replace all data in STAGING database!');
  console.log('⚠️  All existing data in staging will be DELETED!\n');

  const answer = await askQuestion('❓ Type "YES" to confirm and proceed: ');

  if (answer.trim().toUpperCase() !== 'YES') {
    console.log('\n❌ Operation cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\n🚀 Starting database sync...\n');

  let liveConn, stagingConn;

  try {
    // Connect to live database
    console.log('📡 Connecting to live database...');
    liveConn = await mongoose.createConnection(LIVE_URI).asPromise();
    console.log('✓ Connected to live\n');

    // Connect to staging database
    console.log('📡 Connecting to staging database...');
    stagingConn = await mongoose.createConnection(STAGING_URI).asPromise();
    console.log('✓ Connected to staging\n');

    const liveCollections = await getUserCollections(liveConn);
    const stagingCollections = await getUserCollections(stagingConn);

    console.log(`📚 Source collections (live): ${liveCollections.length}`);
    console.log(`📚 Target collections before sync (staging): ${stagingCollections.length}\n`);

    let totalDocuments = 0;
    let totalCollections = 0;

    const staleCollections = stagingCollections.filter(
      (collectionName) => !liveCollections.includes(collectionName)
    );

    if (staleCollections.length) {
      console.log(`🧹 Removing ${staleCollections.length} stale collection(s) in staging...`);
      for (const collectionName of staleCollections) {
        try {
          await stagingConn.collection(collectionName).drop();
          console.log(`   ✓ Dropped stale collection: ${collectionName}`);
        } catch (err) {
          if (err.codeName !== 'NamespaceNotFound') {
            throw err;
          }
        }
      }
      console.log();
    }

    // Sync each source collection
    for (const collectionName of liveCollections) {
      console.log(`📦 Processing collection: ${collectionName}`);

      try {
        const liveCollection = liveConn.collection(collectionName);
        const stagingCollection = stagingConn.collection(collectionName);

        // Get all documents from live
        const documents = await liveCollection.find({}).toArray();
        console.log(`   Found ${documents.length} documents`);

        // Drop the collection in staging database
        try {
          await stagingCollection.drop();
          console.log('   ✓ Cleared staging collection');
        } catch (err) {
          // Collection might not exist, which is fine
          if (err.codeName !== 'NamespaceNotFound') {
            throw err;
          }
        }

        // Insert documents into staging database
        if (documents.length > 0) {
          await stagingCollection.insertMany(documents, { ordered: false });
          console.log(`   ✓ Inserted ${documents.length} documents`);
          totalDocuments += documents.length;
        } else {
          console.log('   ℹ️  Source collection is empty');
        }

        // Copy indexes
        const indexes = await liveCollection.indexes();
        if (indexes.length > 1) { // More than just _id index
          for (const index of indexes) {
            if (index.name !== '_id_') {
              try {
                const key = index.key;
                const options = {};
                if (index.unique) options.unique = true;
                if (index.sparse) options.sparse = true;
                if (index.name) options.name = index.name;

                await stagingCollection.createIndex(key, options);
              } catch (err) {
                console.log(`   ⚠️  Index creation warning: ${err.message}`);
              }
            }
          }
          console.log('   ✓ Copied indexes');
        }

        totalCollections++;
        console.log('   ✅ Completed\n');

      } catch (err) {
        console.error(`   ❌ Error syncing collection "${collectionName}":`, err.message);
        console.log();
      }
    }

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SYNC COMPLETE                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`✅ Successfully synced ${totalCollections} collections`);
    console.log(`✅ Total documents copied: ${totalDocuments}\n`);

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close connections
    if (liveConn) {
      await liveConn.close();
      console.log('✓ Closed live connection');
    }
    if (stagingConn) {
      await stagingConn.close();
      console.log('✓ Closed staging connection');
    }
    rl.close();
    process.exit(0);
  }
}

syncDatabase();
