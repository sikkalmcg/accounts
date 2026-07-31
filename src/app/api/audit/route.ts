import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';

const serialize = (document: any) => ({ ...document, id: document._id.toString(), _id: undefined });

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Required fields validation
    if (!payload.userId || !payload.settingName || !payload.action) {
      return NextResponse.json({ error: 'Missing required fields: userId, settingName, action' }, { status: 400 });
    }

    const logEntry = {
      userId: payload.userId,
      username: payload.username || '',
      action: payload.action, // 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'THEME_CHANGE', 'SOUND_CHANGE', 'SHORTCUT_CHANGE'
      settingName: payload.settingName,
      previousValue: payload.previousValue ?? null,
      newValue: payload.newValue ?? null,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    };

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB audit log failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const result = await (await db).collection('audit_logs').insertOne(logEntry);
    return NextResponse.json(serialize({ ...logEntry, _id: result.insertedId }), { status: 201 });
  } catch (error) {
    console.error('Audit log POST failed', error);
    return NextResponse.json({ error: 'Failed to create audit log entry' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const action = request.nextUrl.searchParams.get('action');
    const limit = Number(request.nextUrl.searchParams.get('limit') || 100);

    const filter: any = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB audit log GET failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const cursor = (await db).collection('audit_logs').find(filter).sort({ timestamp: -1 }).limit(limit);
    return NextResponse.json((await cursor.toArray()).map(serialize));
  } catch (error) {
    console.error('Audit log GET failed', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
