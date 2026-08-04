const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME || 'sikka_lmc';
console.log('Connecting to', uri ? uri.replace(/:[^:@\/]+@/, ':****@') : '(no URI)');
console.log('DB:', dbName);

(async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  try {
    await client.connect();
    console.log('CONNECTED OK');
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    const count = await db.collection('users').countDocuments();
    console.log('users count:', count);
  } catch (err) {
    console.error('CONNECTION FAILED:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
