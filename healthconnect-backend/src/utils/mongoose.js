const mongoose = require('mongoose');

let connectPromise = null;

function resolveMongoUri() {
  const candidates = [
    process.env.MONGODB_URI,
    process.env.PRESCRIPTIONS_MONGODB_URI,
    process.env.DATABASE_URL,
  ];

  for (const value of candidates) {
    const uri = String(value || '').trim();
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
      return uri;
    }
  }

  return '';
}

async function ensureMongoConnected() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    await connectPromise;
    return mongoose.connection;
  }

  const mongoUri = resolveMongoUri();
  if (!mongoUri) {
    throw new Error('MongoDB URI not configured. Set MONGODB_URI or PRESCRIPTIONS_MONGODB_URI.');
  }

  connectPromise = mongoose
    .connect(mongoUri)
    .then((conn) => {
      console.log('[INFO] MongoDB connected for prescriptions');
      return conn;
    })
    .finally(() => {
      connectPromise = null;
    });

  await connectPromise;
  return mongoose.connection;
}

module.exports = {
  ensureMongoConnected,
};
