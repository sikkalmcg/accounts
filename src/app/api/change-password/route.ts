import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, currentPassword, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing required field: userId' }, { status: 400 });
    }
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }
    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    let db;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB change-password failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const collection = (await db).collection('users');
    // Look up by id or username
    let user = await collection.findOne({ id: userId });
    if (!user) {
      user = await collection.findOne({ username: userId });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password (supports plain text legacy or SHA-256 hash)
    const hashedCurrent = crypto.createHash('sha256').update(currentPassword).digest('hex');
    const isMatch = user.password === currentPassword || user.password === hashedCurrent;

    if (!isMatch) {
      return NextResponse.json({ error: 'Current Password is incorrect.' }, { status: 400 });
    }

    // Hash the new password securely
    const hashedNew = crypto.createHash('sha256').update(newPassword).digest('hex');

    const filter = user.id ? { id: user.id } : { username: user.username };
    await collection.findOneAndUpdate(
      filter,
      { $set: { password: hashedNew, updatedAt: new Date().toISOString() } }
    );

    // Audit log
    try {
      const auditCol = (await db).collection('audit_logs');
      if (auditCol && auditCol.insertOne) {
        await auditCol.insertOne({
          userId: user.username || user.id,
          username: user.name || user.username || user.id,
          action: 'CHANGE_PASSWORD',
          settingName: 'Password',
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // ignore audit log errors
    }

    return NextResponse.json({ message: 'Password changed successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Change password failed', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
