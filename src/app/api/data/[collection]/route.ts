import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';
import { roundObjectNumbers } from '@/lib/number-utils';

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
  const payload = roundObjectNumbers(await request.json());
  delete payload.id;

  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('MongoDB POST failed, using fallback DB', err);
    db = getFallbackDb();
  }

  // Section 14: Data Security / Plant Validation for sales_invoices
  if (collection === 'sales_invoices') {
    const plantId = payload.plantId;
    if (!plantId) {
      return NextResponse.json({ error: 'Plant ID is required' }, { status: 400 });
    }

    // Helper to safely get plant array from a record
    const getRecordPlants = (r: any): string[] => {
      if (Array.isArray(r.assignedPlantIds) && r.assignedPlantIds.length > 0) return r.assignedPlantIds;
      if (Array.isArray(r.plantIds) && r.plantIds.length > 0) return r.plantIds;
      return r.plantId ? [r.plantId] : [];
    };

    // 1. Consignor validation against selected Plant
    if (payload.consignorId || payload.consignorName) {
      const firmsCol = (await db).collection('firms');
      const allFirms = await firmsCol.find({}).toArray();
      const matchedFirm = allFirms.find((f: any) => 
        (payload.consignorId && (f._id?.toString() === payload.consignorId || f.id === payload.consignorId)) ||
        (payload.consignorName && f.name === payload.consignorName)
      );

      if (matchedFirm) {
        const firmPlants = getRecordPlants(matchedFirm);
        if (!firmPlants.includes(plantId)) {
          return NextResponse.json({ error: 'Validation failed: Selected Consignor does not belong to the selected Plant.' }, { status: 400 });
        }
      }
    }

    // 2. Bill To Party validation against selected Plant (XD03)
    if (payload.billTo) {
      const custCol = (await db).collection('customers');
      const matchedCust = await custCol.findOne({ customerId: payload.billTo });
      if (matchedCust) {
        const custPlants = getRecordPlants(matchedCust);
        if (!custPlants.includes(plantId)) {
          return NextResponse.json({ error: 'Validation failed: Selected Bill To Party is not applicable to the selected Plant.' }, { status: 400 });
        }
      }
    }

    // 3. Ship To Party validation against selected Plant (XD03)
    if (payload.shipTo && payload.shipTo !== payload.billTo) {
      const custCol = (await db).collection('customers');
      const matchedCust = await custCol.findOne({ customerId: payload.shipTo });
      if (matchedCust) {
        const custPlants = getRecordPlants(matchedCust);
        if (!custPlants.includes(plantId)) {
          return NextResponse.json({ error: 'Validation failed: Selected Ship To Party is not applicable to the selected Plant.' }, { status: 400 });
        }
      }
    }

    // 4. VOF03 Master Validations (Inventory Type, Document Type, Charge Type)
    const billingCol = (await db).collection('billing_types');
    const allBilling = await billingCol.find({}).toArray();
    const plantBilling = allBilling.filter((b: any) => getRecordPlants(b).includes(plantId) && (!b.status || b.status === 'Active'));

    if (plantBilling.length > 0) {
      if (payload.inventoryType) {
        const validInventory = plantBilling.some((b: any) => (b.inventoryType || '').trim().toUpperCase() === payload.inventoryType.trim().toUpperCase());
        if (!validInventory) {
          return NextResponse.json({ error: `Validation failed: Inventory Type '${payload.inventoryType}' is not configured for Plant ${plantId}.` }, { status: 400 });
        }
      }

      if (payload.docType) {
        const validDocType = plantBilling.some((b: any) => (b.documentType || '').trim().toUpperCase() === payload.docType.trim().toUpperCase());
        if (!validDocType) {
          return NextResponse.json({ error: `Validation failed: Document Type '${payload.docType}' is not configured for Plant ${plantId}.` }, { status: 400 });
        }
      }

      if (payload.docCategory) {
        const chargeUpper = payload.docCategory.trim().toUpperCase();
        const validCharge = plantBilling.some((b: any) => {
          const cat = (b.documentCategory || '').trim().toUpperCase();
          return cat === chargeUpper || (chargeUpper === 'REIMBURSEMENT CHARGE' && cat === 'REIMBURSEMENT CHARGES') || (chargeUpper === 'REIMBURSEMENT CHARGES' && cat === 'REIMBURSEMENT CHARGE');
        });
        if (!validCharge && chargeUpper !== 'REIMBURSEMENT CHARGE') {
          return NextResponse.json({ error: `Validation failed: Charge Type '${payload.docCategory}' is not configured for Plant ${plantId}.` }, { status: 400 });
        }
      }
    }

    // 5. REIMBURSEMENT CHARGE VK13 rate record validation
    const chargeType = (payload.docCategory || '').trim().toUpperCase();
    if (chargeType === 'REIMBURSEMENT CHARGE' && Array.isArray(payload.items)) {
      const pricingCol = (await db).collection('pricing');
      const allPricing = await pricingCol.find({}).toArray();
      for (const item of payload.items) {
        if (item.vk13RecordId) {
          const rec = allPricing.find((p: any) => p._id?.toString() === item.vk13RecordId || p.id === item.vk13RecordId);
          if (rec && rec.plantId !== plantId) {
            return NextResponse.json({ error: 'Validation failed: VK13 rate record does not belong to the selected Plant.' }, { status: 400 });
          }
        }
      }
    }
  }

  const document = { ...payload, createdAt: payload.createdAt ?? new Date(), updatedAt: new Date() };
  const result = await (await db).collection(collection).insertOne(document);
  return NextResponse.json(serialize({ ...document, _id: result.insertedId }), { status: 201 });
}


