const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env.development');
require('dotenv').config({ path: envPath });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  keygen: { type: String, default: "" }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function testUserName() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/otsuka_dev';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');
    
    // Find user with no name
    const userNoName = await User.findOne({ email: 'ivancuaco@gmail.com' });
    
    if (userNoName) {
      console.log('Found user without name:');
      console.log('  ID:', userNoName._id);
      console.log('  Name:', userNoName.name || '(empty)');
      console.log('  Email:', userNoName.email);
      
      // Update the name
      console.log('\n📝 Updating name to "Ivan Cuaco"...');
      userNoName.name = 'Ivan Cuaco';
      await userNoName.save();
      console.log('✓ Name updated\n');
      
      // Verify
      const updated = await User.findById(userNoName._id);
      console.log('Verification:');
      console.log('  ID:', updated._id);
      console.log('  Name:', updated.name);
      console.log('  Email:', updated.email);
    } else {
      console.log('User not found');
    }
    
    console.log('\n📊 All users:');
    const allUsers = await User.find().select('name email');
    allUsers.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.name || '(NO NAME)'} <${u.email}>`);
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testUserName();
