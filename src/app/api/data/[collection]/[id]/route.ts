import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';
import { roundObjectNumbers } from '@/lib/number-utils';

const valid = (value: string) => /^[a-zA-Z0-9_-]+$/.test(value);
const idFilter = (id: string) => ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };

async function processSalesInvoiceSecurity(db: any, id: string, data: any): Promise<NextResponse | null> {
  const filter = idFilter(id);
  const original = await (await db).collection('sales_invoices').findOne(filter);
  if (!original) return null;

  const isIrnGenerated = Boolean(original.irnNumber && String(original.irnNumber).trim() !== '');
  if (!isIrnGenerated) return null;

  // Locked fields cannot be changed once IRN is generated:
  data.invoiceNumber = original.invoiceNumber;
  data.invoiceDate = original.invoiceDate;
  data.billMonth = original.billMonth;
  data.billYear = original.billYear;
  data.consignorName = original.consignorName;
  data.consignorId = original.consignorId;
  data.billTo = original.billTo;
  data.shipTo = original.shipTo;
  data.totals = original.totals;
  data.snapshotBillTo = original.snapshotBillTo;
  data.snapshotShipTo = original.snapshotShipTo;

  if (Array.isArray(data.items)) {
    const origItems = original.items || [];
    if (data.items.length !== origItems.length) {
      return NextResponse.json({ error: 'Adding or removing items is not allowed after IRN generation.' }, { status: 400 });
    }

    const pricingCol = (await db).collection('pricing');
    const materialsCol = (await db).collection('materials');
    const sanitizedItems = [];

    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx];
      const orig = origItems.find((o: any) => o.id === item.id) || origItems[idx];
      if (!orig) {
        return NextResponse.json({ error: 'Invalid invoice item specified.' }, { status: 400 });
      }

      const isMaterialChanged = 
        (item.desc && item.desc !== orig.desc) || 
        (item.descName && item.descName !== (orig.descName || orig.desc));

      if (isMaterialChanged) {
        const searchVal = item.desc || item.descName;
        const searchName = item.descName || item.desc;

        const plantPricing = await pricingCol.find({
          plantId: original.plantId,
          $or: [
            { materialCode: searchVal },
            { materialName: searchVal },
            { materialCode: searchName },
            { materialName: searchName }
          ]
        }).toArray();

        const targetCharge = ((data.docCategory || original.docCategory) as string || '').trim().toUpperCase();

        let matchedPricing = plantPricing.find((p: any) => 
          p.customerCode === original.billTo && 
          (p.documentCategory || '').trim().toUpperCase() === targetCharge
        );
        if (!matchedPricing) {
          matchedPricing = plantPricing.find((p: any) => 
            (p.documentCategory || '').trim().toUpperCase() === targetCharge
          );
        }
        if (!matchedPricing) {
          matchedPricing = plantPricing.find((p: any) => p.customerCode === original.billTo);
        }
        if (!matchedPricing && plantPricing.length > 0) {
          matchedPricing = plantPricing[0];
        }

        const matchedMaterial = await materialsCol.findOne({
          $or: [
            { materialCode: searchVal },
            { productName: searchVal },
            { materialCode: searchName },
            { productName: searchName }
          ]
        });

        let newRate: number | null = null;
        let newHsn: string = "";

        if (matchedPricing && matchedPricing.price !== undefined && matchedPricing.price !== null && matchedPricing.price !== '') {
          newRate = Number(matchedPricing.price);
        } else if (matchedMaterial && matchedMaterial.price !== undefined && matchedMaterial.price !== null && matchedMaterial.price !== '') {
          newRate = Number(matchedMaterial.price);
        } else if (item._newRate !== undefined) {
          newRate = Number(item._newRate);
        }

        if (matchedPricing && matchedPricing.hsnSac) {
          newHsn = String(matchedPricing.hsnSac).trim();
        } else if (matchedMaterial && matchedMaterial.hsnSac) {
          newHsn = String(matchedMaterial.hsnSac).trim();
        } else if (item._newHsn !== undefined) {
          newHsn = String(item._newHsn).trim();
        }

        const origRate = Number(orig.rate || 0);
        const origHsn = String(orig.hsn || '').trim();

        const rateMatch = newRate !== null && !isNaN(newRate) && Math.abs(newRate - origRate) < 0.001;
        const hsnMatch = newHsn === origHsn;

        if (!rateMatch || !hsnMatch) {
          if (!rateMatch && !hsnMatch) {
            return NextResponse.json({
              error: "Material cannot be changed because the Basic Rate and HSN/SAC of the selected material are different from the existing invoice item. After IRN generation, Material can be changed only when both Basic Rate and HSN/SAC are the same."
            }, { status: 400 });
          }
          if (!hsnMatch) {
            return NextResponse.json({
              error: "Material cannot be changed because the HSN/SAC of the selected material is different from the existing invoice item. After IRN generation, Material can be changed only when both Basic Rate and HSN/SAC are the same."
            }, { status: 400 });
          }
          return NextResponse.json({
            error: "Material cannot be changed because the Basic Rate of the selected material is different from the existing invoice rate. After IRN generation, Material can be changed only when both Basic Rate and HSN/SAC are the same."
          }, { status: 400 });
        }

        // Allowed Material change: update only material identity, preserve all existing financial values
        sanitizedItems.push({
          ...orig,
          desc: item.desc,
          descName: item.descName || matchedPricing?.materialName || matchedMaterial?.productName || item.desc,
          activity: item.activity !== undefined ? item.activity : orig.activity,
          hsn: orig.hsn,
          rate: orig.rate,
          amount: orig.amount,
          gstRate: orig.gstRate,
          qty: orig.qty,
          uom: orig.uom,
          customValues: item.customValues !== undefined ? item.customValues : orig.customValues,
        });
      } else {
        // Material not changed: allow activity, hsn, customValues while preserving all financials
        sanitizedItems.push({
          ...orig,
          activity: item.activity !== undefined ? item.activity : orig.activity,
          hsn: item.hsn !== undefined ? item.hsn : orig.hsn,
          customValues: item.customValues !== undefined ? item.customValues : orig.customValues,
          rate: orig.rate,
          amount: orig.amount,
          gstRate: orig.gstRate,
          qty: orig.qty,
          uom: orig.uom,
        });
      }
    }
    data.items = sanitizedItems;
  } else {
    data.items = original.items;
  }

  return null;
}

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

  if (collection === 'sales_invoices') {
    const errorResponse = await processSalesInvoiceSecurity(db, id, data);
    if (errorResponse) return errorResponse;
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

  if (collection === 'sales_invoices') {
    const errorResponse = await processSalesInvoiceSecurity(db, id, data);
    if (errorResponse) return errorResponse;
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


