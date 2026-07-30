import { Db, MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'sikka_lmc';

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error('MONGODB_URI is not configured. Add it to .env.local before starting the app.');
  // Do not keep a rejected promise in the module cache. Atlas can briefly fail
  // DNS/network selection; caching that failure made every later login fail
  // until the entire Next server was restarted.
  if (!global.mongoClientPromise) {
    global.mongoClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      retryReads: true,
      retryWrites: true,
    }).connect().catch((error) => {
      global.mongoClientPromise = undefined;
      throw error;
    });
  }
  return (await global.mongoClientPromise).db(databaseName);
}


