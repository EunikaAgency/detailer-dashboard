import mongoose from 'mongoose';

const resolveDefaultDbName = () => {
  const appEnv = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || '').toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();

  if (appEnv === 'staging' || vercelEnv === 'preview') return 'otsuka_dev';
  if (appEnv === 'production' || process.env.NODE_ENV === 'production') return 'otsuka_prod';
  return 'otsuka_dev';
};

const defaultDbName = resolveDefaultDbName();
const MONGO_URI = process.env.MONGO_URI || `mongodb://localhost:27017/${defaultDbName}`;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
