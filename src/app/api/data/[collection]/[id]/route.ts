import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';
import { roundObjectNumbers } from '@/lib/number-utils';

const valid = (value: string) => /^[a-zA-Z0-9_-]+$/.test(value);
const idFilter = (id: string) => ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const data = roundObjectNumbers(await request.json());
  delete data.id;
  delete data._id;
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('MongoDB PATCH failed, using fallback DB', err);
    db = getFallbackDb();
  }
  const result = await (await db).collection(collection).findOneAndUpdate(idFilter(id), { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...result, id: result._id.toString(), _id: undefined });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const data = roundObjectNumbers(await request.json());
  delete data.id;
  delete data._id;
  delete data.createdAt;
  const filter = idFilter(id);
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('MongoDB PUT failed, using fallback DB', err);
    db = getFallbackDb();
  }
  const result = await (await db).collection(collection).findOneAndUpdate(
    filter,
    {
      $set: { ...data, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date(), ...(filter._id ? {} : { id }) },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return NextResponse.json({ ...result!, id: result!._id.toString(), _id: undefined });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('MongoDB DELETE failed, using fallback DB', err);
    db = getFallbackDb();
  }
  const result = await (await db).collection(collection).deleteOne(idFilter(id));
  return new NextResponse(null, { status: result.deletedCount ? 204 : 404 });
}


