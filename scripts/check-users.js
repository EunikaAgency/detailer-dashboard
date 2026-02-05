const mongoose = require('mongoose');
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
  name: String,
  email: String,
  password: String,
  keygen: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find().limit(10);
    console.log('\n=== USERS IN DATABASE ===');
    console.log('Total users:', users.length);
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log('  ID:', user._id.toString());
      console.log('  Name:', user.name || '(empty/undefined)');
      console.log('  Email:', user.email);
      console.log('  Has Keygen:', !!user.keygen);
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUsers();
