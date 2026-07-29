import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const ALL_TCODES = [
  'DB01', 'XD01', 'XD02', 'XD03', 'ZCODE',
  'OP01', 'OP02', 'OP03',
  'FM01', 'FM02', 'FM03',
  'XK01', 'XK02', 'XK03',
  'VK11', 'VK12', 'VK13',
  'VL01', 'VL02', 'VL03',
  'MM01', 'MM02', 'MM03',
  'VOF01', 'VOF02', 'VOF03',
  'MIGO',
  'VF01', 'VF02', 'VF03', 'VF11',
  'IRN01', 'IRN02', 'IRN03',
  'ZINV',
  'FB03', 'F110',
  'SU01', 'SU02', 'SU03'
];

export async function GET() {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ username: 'ajaysomra' });

    if (existingUser) {
      return NextResponse.json({
        message: 'Admin user already exists',
        user: {
          username: existingUser.username,
          name: existingUser.name,
          role: existingUser.role,
        }
      });
    }

    const newUser = {
      username: 'ajaysomra',
      password: 'Mayank@2012',
      name: 'Admin',
      role: 'admin',
      assignedPlantIds: [],
      tcodePermissions: ALL_TCODES,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: {
        id: result.insertedId.toString(),
        username: 'ajaysomra',
        name: 'Admin',
        role: 'admin',
        tcodePermissions: ALL_TCODES,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to seed admin user', details: error.message },
      { status: 500 }
    );
  }
}

