import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';

const serialize = (document: any) => ({ ...document, id: document._id.toString(), _id: undefined });

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const { userId, ...updateData } = payload;

    if (!userId) {
      return NextResponse.json({ error: 'Missing required field: userId' }, { status: 400 });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData._id;
    delete updateData.username;
    delete updateData.password;
    delete updateData.createdAt;

    // Add update timestamp
    updateData.updatedAt = new Date().toISOString();

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB user-profile PATCH failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const result = await (await db).collection('users').findOneAndUpdate(
      { id: userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(serialize(result));
  } catch (error) {
    console.error('User profile PATCH failed', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}

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
      console.error('MongoDB user-profile GET failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const user = await (await db).collection('users').findOne({ id: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't return password
    const { password, ...safeUser } = user;
    return NextResponse.json(serialize(safeUser));
  } catch (error) {
    console.error('User profile GET failed', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}
