/**
 * Dry Run: Preview Staging to Live Sync
 * 
 * This script shows what WOULD be synced without making any changes.
 * Safe to run - no data will be modified.
 * 
 * Usage:
 *   npm run sync-db:preview
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const dotenv = require('dotenv');
const devEnvPath = path.join(__dirname, '..', '.env.development');
const prodEnvPath = path.join(__dirname, '..', '.env.production');

const devEnv = dotenv.parse(fs.readFileSync(devEnvPath));
const prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));

const STAGING_URI = devEnv.MONGO_URI || 'mongodb://localhost:27017/otsuka_dev';
const LIVE_URI = prodEnv.MONGO_URI || 'mongodb://localhost:27017/otsuka_prod';

const COLLECTIONS = ['users', 'doctors', 'appointments', 'products', 'presentations'];

async function previewSync() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         DRY RUN: SYNC PREVIEW (NO CHANGES)                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 Configuration:');
  console.log(`   Staging: ${STAGING_URI}`);
  console.log(`   Live:    ${LIVE_URI}\n`);
  
  let stagingConn, liveConn;
  
  try {
    console.log('📡 Connecting to databases...');
    stagingConn = await mongoose.createConnection(STAGING_URI).asPromise();
    liveConn = await mongoose.createConnection(LIVE_URI).asPromise();
    console.log('✓ Connected\n');
    
    console.log('📊 Current State:\n');
    
    let totalStagingDocs = 0;
    let totalLiveDocs = 0;
    
    for (const collectionName of COLLECTIONS) {
      try {
        const stagingCollections = await stagingConn.db.listCollections({ name: collectionName }).toArray();
        const liveCollections = await liveConn.db.listCollections({ name: collectionName }).toArray();
        
        let stagingCount = 0;
        let liveCount = 0;
        
        if (stagingCollections.length > 0) {
          stagingCount = await stagingConn.collection(collectionName).countDocuments();
          totalStagingDocs += stagingCount;
        }
        
        if (liveCollections.length > 0) {
          liveCount = await liveConn.collection(collectionName).countDocuments();
          totalLiveDocs += liveCount;
        }
        
        const arrow = stagingCount > 0 ? '→' : ' ';
        console.log(`   ${collectionName.padEnd(20)} ${String(stagingCount).padStart(4)} ${arrow} ${String(liveCount).padStart(4)}`);
        
      } catch (err) {
        console.log(`   ${collectionName.padEnd(20)} Error: ${err.message}`);
      }
    }
    
    console.log(`\n   ${'TOTAL'.padEnd(20)} ${String(totalStagingDocs).padStart(4)} → ${String(totalLiveDocs).padStart(4)}`);
    
    console.log('\n📝 What would happen:');
    console.log(`   • ${totalLiveDocs} documents in LIVE would be deleted`);
    console.log(`   • ${totalStagingDocs} documents from STAGING would be copied to LIVE`);
    console.log(`   • All indexes would be recreated\n`);
    
    console.log('ℹ️  To perform actual sync, run: npm run sync-db\n');
    
  } catch (error) {
    console.error('\n❌ Preview failed:', error.message);
  } finally {
    if (stagingConn) await stagingConn.close();
    if (liveConn) await liveConn.close();
    process.exit(0);
  }
}

previewSync();
