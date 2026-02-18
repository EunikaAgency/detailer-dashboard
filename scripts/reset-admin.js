/**
 * Reset Admin Script
 * 
 * This script wipes all users from the database and creates a fresh admin account.
 * 
 * Usage:
 *   Development: npm run reset-admin
 *   Production:  npm run reset-admin:prod
 * 
 * Admin Credentials:
 *   Name:     Eunika
 *   Email:    info@eunika.agency
 *   Password: justinianthegreat!
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.development or .env.production
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';
const envPath = path.join(__dirname, '..', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envFile}`);
} else {
  require('dotenv').config();
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  keygen: { type: String, default: "" }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function resetAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/otsuka_dev';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);
    
    // Delete all existing users
    const deleteResult = await User.deleteMany({});
    console.log(`\n✓ Deleted ${deleteResult.deletedCount} user(s) from database`);
    
    // Admin credentials
    const adminData = {
      name: 'Eunika',
      email: 'info@eunika.agency',
      password: 'justinianthegreat!'
    };
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    
    // Create admin user
    const adminUser = await User.create({
      name: adminData.name,
      email: adminData.email,
      password: hashedPassword
    });
    
    // Generate keygen
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      adminUser.keygen = jwt.sign(
        { userId: adminUser._id.toString(), email: adminUser.email },
        jwtSecret
      );
      await adminUser.save();
    }
    
    console.log('\n✓ Admin user created successfully:');
    console.log('  Name:', adminUser.name);
    console.log('  Email:', adminUser.email);
    console.log('  ID:', adminUser._id.toString());
    console.log('  Keygen:', adminUser.keygen || '(not generated - JWT_SECRET missing)');
    
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

resetAdmin();
