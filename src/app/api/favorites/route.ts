import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';
import { getTcodeTitle, isValidTcode } from '@/lib/tcode-metadata';

const serialize = (document: any) => ({ ...document, id: document._id ? document._id.toString() : document.id, _id: undefined });

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing required parameter: userId' }, { status: 400 });
    }

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB favorites GET failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const collection = (await db).collection('favorites');
    const favorites = await collection.find({ userId }).toArray();
    return NextResponse.json(favorites.map(serialize));
  } catch (error) {
    console.error('Failed to get favorites', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tcode: rawTcode } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing required field: userId' }, { status: 400 });
    }
    if (!rawTcode || typeof rawTcode !== 'string') {
      return NextResponse.json({ error: 'Invalid T-Code. Please enter a valid T-Code.' }, { status: 400 });
    }

    const tcode = rawTcode.trim().toUpperCase();

    // Validate T-Code exists
    if (!isValidTcode(tcode)) {
      return NextResponse.json({ error: 'Invalid T-Code. Please enter a valid T-Code.' }, { status: 400 });
    }

    const description = getTcodeTitle(tcode) || tcode;

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB favorites POST failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const collection = (await db).collection('favorites');

    // Check duplicate favorite for this user
    const existing = await collection.findOne({ userId, tcode });
    if (existing) {
      return NextResponse.json({ error: 'This T-Code is already added to Favorites.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newDoc = {
      userId,
      tcode,
      description,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(newDoc);

    return NextResponse.json(
      serialize({ ...newDoc, _id: (result as any).insertedId || (result as any).id }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to add favorite', error);
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let userId = request.nextUrl.searchParams.get('userId');
    let rawTcode = request.nextUrl.searchParams.get('tcode');

    // Also support JSON body if sent via DELETE
    if (!userId || !rawTcode) {
      try {
        const body = await request.json();
        if (body.userId) userId = body.userId;
        if (body.tcode) rawTcode = body.tcode;
      } catch {
        // body might be empty if params were in query
      }
    }

    if (!userId || !rawTcode) {
      return NextResponse.json({ error: 'Missing userId or tcode' }, { status: 400 });
    }

    const tcode = rawTcode.trim().toUpperCase();

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB favorites DELETE failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const collection = (await db).collection('favorites');

    // Check if the T-Code is present in user's favorites
    const existing = await collection.findOne({ userId, tcode });
    if (!existing) {
      return NextResponse.json({ error: 'This T-Code is not available in your Favorites.' }, { status: 400 });
    }

    // Delete only that user's record
    await collection.deleteOne({ userId, tcode });

    return NextResponse.json({ message: 'Favorite removed successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Failed to remove favorite', error);
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
