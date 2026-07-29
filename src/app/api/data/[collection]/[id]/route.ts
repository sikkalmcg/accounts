import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

const valid = (value: string) => /^[a-zA-Z0-9_-]+$/.test(value);
const idFilter = (id: string) => ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const data = await request.json(); delete data.id; delete data._id;
  const result = await (await getDb()).collection(collection).findOneAndUpdate(idFilter(id), { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...result, id: result._id.toString(), _id: undefined });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const data = await request.json(); delete data.id; delete data._id;
  const filter = idFilter(id);
  const result = await (await getDb()).collection(collection).findOneAndUpdate(filter, { $set: { ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), ...(filter._id ? {} : { id }) } }, { upsert: true, returnDocument: 'after' });
  return NextResponse.json({ ...result!, id: result!._id.toString(), _id: undefined });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!valid(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const result = await (await getDb()).collection(collection).deleteOne(idFilter(id));
  return new NextResponse(null, { status: result.deletedCount ? 204 : 404 });
}


