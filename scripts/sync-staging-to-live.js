/**
 * Sync Staging to Live Database
 * 
 * This script copies ALL data from staging (otsuka_dev) to live (otsuka_prod).
 * ⚠️  WARNING: This will COMPLETELY REPLACE all data in the production database!
 * 
 * Usage:
 *   npm run sync-db
 * 
 * The script will:
 * 1. Connect to both staging and live databases
 * 2. Drop all collections in live database
 * 3. Copy all documents from staging to live
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

// Collections to sync
const COLLECTIONS = ['users', 'doctors', 'appointments', 'products', 'presentations'];

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
  console.log('║         SYNC STAGING TO LIVE DATABASE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 Configuration:');
  console.log(`   Staging: ${STAGING_URI}`);
  console.log(`   Live:    ${LIVE_URI}`);
  console.log(`   Collections: ${COLLECTIONS.join(', ')}\n`);
  
  console.log('⚠️  WARNING: This will completely replace all data in LIVE database!');
  console.log('⚠️  All existing data in production will be DELETED!\n');
  
  const answer = await askQuestion('❓ Type "YES" to confirm and proceed: ');
  
  if (answer.trim().toUpperCase() !== 'YES') {
    console.log('\n❌ Operation cancelled.');
    rl.close();
    process.exit(0);
  }
  
  console.log('\n🚀 Starting database sync...\n');
  
  let stagingConn, liveConn;
  
  try {
    // Connect to staging database
    console.log('📡 Connecting to staging database...');
    stagingConn = await mongoose.createConnection(STAGING_URI).asPromise();
    console.log('✓ Connected to staging\n');
    
    // Connect to live database
    console.log('📡 Connecting to live database...');
    liveConn = await mongoose.createConnection(LIVE_URI).asPromise();
    console.log('✓ Connected to live\n');
    
    let totalDocuments = 0;
    let totalCollections = 0;
    
    // Sync each collection
    for (const collectionName of COLLECTIONS) {
      console.log(`📦 Processing collection: ${collectionName}`);
      
      try {
        // Check if collection exists in staging
        const collections = await stagingConn.db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log(`   ⚠️  Collection "${collectionName}" not found in staging, skipping...\n`);
          continue;
        }
        
        const stagingCollection = stagingConn.collection(collectionName);
        const liveCollection = liveConn.collection(collectionName);
        
        // Get all documents from staging
        const documents = await stagingCollection.find({}).toArray();
        console.log(`   Found ${documents.length} documents`);
        
        if (documents.length === 0) {
          console.log(`   ℹ️  No documents to sync\n`);
          continue;
        }
        
        // Drop the collection in live database
        try {
          await liveCollection.drop();
          console.log(`   ✓ Cleared live collection`);
        } catch (err) {
          // Collection might not exist, which is fine
          if (err.codeName !== 'NamespaceNotFound') {
            throw err;
          }
        }
        
        // Insert documents into live database
        if (documents.length > 0) {
          await liveCollection.insertMany(documents, { ordered: false });
          console.log(`   ✓ Inserted ${documents.length} documents`);
          totalDocuments += documents.length;
        }
        
        // Copy indexes
        const indexes = await stagingCollection.indexes();
        if (indexes.length > 1) { // More than just _id index
          for (const index of indexes) {
            if (index.name !== '_id_') {
              try {
                const key = index.key;
                const options = {};
                if (index.unique) options.unique = true;
                if (index.sparse) options.sparse = true;
                if (index.name) options.name = index.name;
                
                await liveCollection.createIndex(key, options);
              } catch (err) {
                console.log(`   ⚠️  Index creation warning: ${err.message}`);
              }
            }
          }
          console.log(`   ✓ Copied indexes`);
        }
        
        totalCollections++;
        console.log(`   ✅ Completed\n`);
        
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
    if (stagingConn) {
      await stagingConn.close();
      console.log('✓ Closed staging connection');
    }
    if (liveConn) {
      await liveConn.close();
      console.log('✓ Closed live connection');
    }
    rl.close();
    process.exit(0);
  }
}

syncDatabase();
