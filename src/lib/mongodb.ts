import { Db, MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'sikka_lmc';

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error('MONGODB_URI is not configured. Add it to .env.local before starting the app.');
  const clientPromise = global.mongoClientPromise ?? new MongoClient(uri).connect();
  if (process.env.NODE_ENV !== 'production') global.mongoClientPromise = clientPromise;
  return (await clientPromise).db(databaseName);
}


