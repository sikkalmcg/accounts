import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';

const collectionNamePattern = /^[a-zA-Z0-9_-]+$/;
const serialize = (document: any) => ({ ...document, id: document._id.toString(), _id: undefined });

export async function GET(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  try {
    const { collection } = await params;
    if (!collectionNamePattern.test(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
    const query = request.nextUrl.searchParams.get('query');
    const sort = request.nextUrl.searchParams.get('sort');
    const limit = Number(request.nextUrl.searchParams.get('limit') || 0);
    const filter = query ? JSON.parse(query) : {};
    const sortSpec = sort ? JSON.parse(sort) : undefined;
    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB GET failed, using fallback DB', err);
      db = getFallbackDb();
    }
    const cursor = (await db).collection(collection).find(filter);
    if (sortSpec) cursor.sort(sortSpec);
    if (limit) cursor.limit(limit);
    return NextResponse.json((await cursor.toArray()).map(serialize));
  } catch (error) {
    console.error('MongoDB GET request failed', error);
    return NextResponse.json({ error: 'Database connection is temporarily unavailable. Please retry.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!collectionNamePattern.test(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 });
  const payload = await request.json();
  delete payload.id;
  const document = { ...payload, createdAt: payload.createdAt ?? new Date(), updatedAt: new Date() };
  const result = await (await getDb()).collection(collection).insertOne(document);
  return NextResponse.json(serialize({ ...document, _id: result.insertedId }), { status: 201 });
}


