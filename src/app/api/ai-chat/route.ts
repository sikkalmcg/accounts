import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';
import { TCODE_METADATA } from '@/lib/tcode-metadata';
import { ai } from '@/ai/genkit';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  message: string;
  history?: ChatMessage[];
  context?: {
    currentTcode?: string;
    username?: string;
    name?: string;
    role?: string;
  };
}

// Helper to fetch live database context for the AI
async function getLiveProjectContext(query: string, currentTcode?: string) {
  let db: any;
  try {
    db = await getDb();
  } catch (err) {
    db = getFallbackDb();
  }

  const cleanQuery = query.toLowerCase();

  // Parallel database metrics gathering
  const [
    invoicesCount,
    pendingInvoices,
    recentInvoices,
    plants,
    firms,
    materialsCount,
    customersCount,
    vendorsCount,
  ] = await Promise.all([
    db.collection('sales_invoices').countDocuments ? db.collection('sales_invoices').countDocuments().catch(() => 0) : 0,
    db.collection('sales_invoices').find({ status: { $in: ['Pending', 'Draft', 'Unpaid', 'PENDING'] } }).limit(5).toArray().catch(() => []),
    db.collection('sales_invoices').find({}).sort({ createdAt: -1 }).limit(5).toArray().catch(() => []),
    db.collection('plants').find({}).limit(15).toArray().catch(() => []),
    db.collection('firms').find({}).limit(15).toArray().catch(() => []),
    db.collection('materials').countDocuments ? db.collection('materials').countDocuments().catch(() => 0) : 0,
    db.collection('customers').countDocuments ? db.collection('customers').countDocuments().catch(() => 0) : 0,
    db.collection('vendors').countDocuments ? db.collection('vendors').countDocuments().catch(() => 0) : 0,
  ]);

  // Targeted searches if user query contains specific keywords
  let targetedSearchResults: any = {};

  // Check if query is looking for specific invoice
  const invoiceNumberMatch = query.match(/(?:inv|invoice|bill)[\s#:-]*([a-zA-Z0-9_-]+)/i);
  if (invoiceNumberMatch && invoiceNumberMatch[1]) {
    const invId = invoiceNumberMatch[1];
    const foundInvoice = await db.collection('sales_invoices').findOne({
      $or: [
        { invoiceNo: { $regex: invId, $options: 'i' } },
        { invoiceNumber: { $regex: invId, $options: 'i' } },
        { _id: invId }
      ]
    }).catch(() => null);
    if (foundInvoice) {
      targetedSearchResults.specificInvoice = foundInvoice;
    }
  }

  // Check if user is asking for plants or firms
  if (cleanQuery.includes('plant') || cleanQuery.includes('factory')) {
    targetedSearchResults.plants = plants.map((p: any) => ({
      plantId: p.plantId || p.code || p.id,
      name: p.name,
      city: p.city || p.location,
      state: p.state
    }));
  }

  if (cleanQuery.includes('firm') || cleanQuery.includes('company')) {
    targetedSearchResults.firms = firms.map((f: any) => ({
      firmId: f.firmId || f.code || f.id,
      name: f.name,
      gstin: f.gstin || f.gstNumber
    }));
  }

  // Active TCode details
  const currentTcodeInfo = currentTcode && TCODE_METADATA[currentTcode] 
    ? { code: currentTcode, title: TCODE_METADATA[currentTcode] } 
    : null;

  return {
    metrics: {
      totalInvoices: invoicesCount,
      recentInvoicesCount: recentInvoices.length,
      totalPlants: plants.length,
      totalFirms: firms.length,
      totalMaterials: materialsCount,
      totalCustomers: customersCount,
      totalVendors: vendorsCount,
    },
    activeScreen: currentTcodeInfo,
    recentInvoices: recentInvoices.map((inv: any) => ({
      invoiceNo: inv.invoiceNo || inv.invoiceNumber || inv._id,
      customer: inv.customerName || inv.customerCode,
      amount: inv.totalAmount || inv.grandTotal || inv.netAmount,
      status: inv.status || 'Active',
      date: inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : 'N/A'
    })),
    pendingInvoices: pendingInvoices.map((inv: any) => ({
      invoiceNo: inv.invoiceNo || inv.invoiceNumber || inv._id,
      customer: inv.customerName || inv.customerCode,
      amount: inv.totalAmount || inv.grandTotal,
      status: inv.status
    })),
    plantsSummary: plants.map((p: any) => `${p.plantId || p.code || p.id}: ${p.name}`),
    firmsSummary: firms.map((f: any) => `${f.firmId || f.code || f.id}: ${f.name}`),
    targetedSearchResults
  };
}

// Intelligent offline/rule-based assistant when Gemini API key is missing or offline
function generateSmartERPResponse(
  message: string, 
  dataContext: any, 
  currentTcode?: string, 
  userName?: string
): { reply: string; suggestedTcodes: string[] } {
  const q = message.toLowerCase().trim();
  const suggestedTcodes: string[] = [];

  // Greeting
  if (/^(hi|hello|hey|namaste|pranam|good morning|good afternoon)/i.test(q)) {
    const greeting = userName ? `Hello **${userName}**!` : 'Hello!';
    const tcodeMsg = dataContext.activeScreen 
      ? `\n\nYou are currently on **[${dataContext.activeScreen.code}] - ${dataContext.activeScreen.title}**.` 
      : '';

    return {
      reply: `${greeting} Welcome to **Sikka LMC Accounts AI Assistant**! 🤖${tcodeMsg}\n\nI can help you with:\n- 📄 **Invoices & Billing** (Recent invoices, pending payments, invoice status)\n- 🏢 **Master Data** (Plants, Firms, Materials, Customers, Vendors)\n- 🔍 **T-Code Guide** (Find which transaction code to use for any task)\n- 🛠️ **Troubleshooting & Errors** (Save failures, authorization, duplicate checks)\n\nWhat would you like assistance with today? Aap mujhse Hindi ya English dono me pooch sakte hain!`,
      suggestedTcodes: ['DB01', 'VF01', 'FB03', 'OP03']
    };
  }

  // Problem / Error / Save / Validation troubleshooting
  if (q.includes('save') || q.includes('error') || q.includes('problem') || q.includes('dikkat') || q.includes('nahi ho raha') || q.includes('failed') || q.includes('permission') || q.includes('unauthorized') || q.includes('locked')) {
    return {
      reply: `### 🛠️ Troubleshooting Common Sikka LMC Issues:\n\n1. **Invoice not saving?**\n   - Check if **Plant ID** is selected. Every invoice requires a valid Plant ID.\n   - Ensure your user account is assigned to that Plant ID.\n   - Ensure all line items have valid Material, Quantity $> 0$, and Unit Price.\n\n2. **Duplicate Entry Error?**\n   - Plant Code, Firm ID, or Invoice Numbers must be unique.\n   - If editing, verify you are modifying the intended record via change T-Codes (**[OP02]**, **[FM02]**, **[VF02]**).\n\n3. **"Locked" or "Access Denied" on T-Codes?**\n   - Your account permissions are managed in **[SU02]** (Change User Permissions).\n   - Contact your administrator (**ajaysomra**) to assign the required T-Codes to your username.\n\nWhat specific error message are you seeing on screen? Aap bata sakte hain kahan issue aa raha hai.`,
      suggestedTcodes: ['SU02', 'DB01', 'VF01']
    };
  }

  // Invoice status or list query
  if (q.includes('invoice') || q.includes('bill') || q.includes('challan') || q.includes('irn')) {
    if (dataContext.targetedSearchResults.specificInvoice) {
      const inv = dataContext.targetedSearchResults.specificInvoice;
      suggestedTcodes.push('FB03', 'VF03');
      return {
        reply: `### 📄 Invoice Details Found:\n- **Invoice No:** \`${inv.invoiceNo || inv.invoiceNumber || inv._id}\`\n- **Customer:** ${inv.customerName || inv.customerCode || 'N/A'}\n- **Plant ID:** \`${inv.plantId || 'N/A'}\`\n- **Firm ID:** \`${inv.firmId || 'N/A'}\`\n- **Total Amount:** ₹${Number(inv.totalAmount || inv.grandTotal || 0).toLocaleString('en-IN')}\n- **Status:** **${inv.status || 'Active'}**\n- **IRN:** ${inv.irn ? `\`${inv.irn.substring(0, 16)}...\`` : 'Pending / Not Generated'}\n\n👉 You can view payment details in **[FB03]** or display the full invoice in **[VF03]**.`,
        suggestedTcodes
      };
    }

    if (q.includes('pending') || q.includes('unpaid') || q.includes('due') || q.includes('baki')) {
      suggestedTcodes.push('FB03', 'F110');
      const pendingList = dataContext.pendingInvoices;
      if (pendingList.length === 0) {
        return {
          reply: `✅ **No pending invoices found** in the system! All recorded invoices are processed or marked paid.\n\nTo view all invoice statuses, open **[FB03]** (Invoice Payment Status).`,
          suggestedTcodes
        };
      }
      const listStr = pendingList.map((p: any) => `- **${p.invoiceNo}**: ${p.customer || 'Customer'} — ₹${Number(p.amount || 0).toLocaleString('en-IN')} (${p.status})`).join('\n');
      return {
        reply: `### ⏳ Pending Invoices (${pendingList.length} Found):\n${listStr}\n\n👉 To manage invoice payments, use **[FB03]** or generate payment proofs in **[F110]**.`,
        suggestedTcodes
      };
    }

    // General invoices list
    suggestedTcodes.push('VF01', 'VF03', 'FB03', 'ZINV');
    const recent = dataContext.recentInvoices;
    const count = dataContext.metrics.totalInvoices || recent.length;
    const recentStr = recent.length > 0 
      ? recent.map((r: any) => `- **${r.invoiceNo}** | ${r.customer || 'N/A'} | ₹${Number(r.amount || 0).toLocaleString('en-IN')} | *${r.status}* (${r.date})`).join('\n')
      : 'No invoices recorded yet.';

    return {
      reply: `### 📊 Sikka Invoices Overview:\n- **Total Invoices Recorded:** ${count}\n\n**Recent Invoices:**\n${recentStr}\n\n**Helpful T-Codes:**\n- **[VF01]**: Create New Invoice\n- **[VF02]**: Edit/Change Invoice\n- **[VF03]**: Display Invoice Details\n- **[VF11]**: Cancel Invoice\n- **[FB03]**: Invoice Payment Status\n- **[ZINV]**: Detailed Invoice Report`,
      suggestedTcodes
    };
  }

  // Plants query
  if (q.includes('plant') || q.includes('factory') || q.includes('location')) {
    suggestedTcodes.push('OP01', 'OP02', 'OP03');
    const plants = dataContext.plantsSummary;
    const pStr = plants.length > 0 ? plants.map((p: string) => `- 🏭 **${p}**`).join('\n') : 'No plants found.';
    return {
      reply: `### 🏭 Registered Plants (${dataContext.metrics.totalPlants}):\n${pStr}\n\n**Plant Management T-Codes:**\n- **[OP01]**: Create Plant\n- **[OP02]**: Edit Plant\n- **[OP03]**: Display All Plants\n\n*Tip: Each invoice must have an assigned plant where you have operational permissions.*`,
      suggestedTcodes
    };
  }

  // Firms query
  if (q.includes('firm') || q.includes('company') || q.includes('entity')) {
    suggestedTcodes.push('FM01', 'FM02', 'FM03');
    const firms = dataContext.firmsSummary;
    const fStr = firms.length > 0 ? firms.map((f: string) => `- 🏢 **${f}**`).join('\n') : 'No firms found.';
    return {
      reply: `### 🏢 Registered Firms (${dataContext.metrics.totalFirms}):\n${fStr}\n\n**Firm Management T-Codes:**\n- **[FM01]**: Create Firm\n- **[FM02]**: Edit Firm\n- **[FM03]**: Display All Firms`,
      suggestedTcodes
    };
  }

  // Payment / Accounting
  if (q.includes('payment') || q.includes('pay') || q.includes('paisa') || q.includes('receipt') || q.includes('outgoing')) {
    suggestedTcodes.push('FB03', 'F110', 'F51', 'F53');
    return {
      reply: `### 💳 Payments & Accounting Assistance:\nHere are the transactions to handle payments:\n- **[FB03]**: **Invoice Payment Status** (Check if an invoice has been paid, pending amount, or payment receipts)\n- **[F110]**: **Payment Proof Report** (Generate and print verified payment proofs)\n- **[F51]**: **Post Outgoing Payment** (Record payments made to vendors)\n- **[F52]**: **Revise Outgoing Payment** (Modify existing payment records)\n- **[F53]**: **Outgoing Payment Records** (Complete history of outgoing transactions)\n\nWould you like me to look up a specific invoice or vendor payment?`,
      suggestedTcodes
    };
  }

  // Materials / Inventory
  if (q.includes('material') || q.includes('item') || q.includes('product') || q.includes('stock') || q.includes('hsn')) {
    suggestedTcodes.push('MM01', 'MM02', 'MM03', 'MIGO');
    return {
      reply: `### 📦 Material & Inventory Management:\n- **Total Materials in Master:** ${dataContext.metrics.totalMaterials}\n\n**Relevant T-Codes:**\n- **[MM01]**: Create New Material (Define description, unit of measure, HSN code, tax rates)\n- **[MM02]**: Change Existing Material\n- **[MM03]**: Display Materials Master\n- **[MIGO]**: Goods Movement (Receipts, transfers, consumption)`,
      suggestedTcodes
    };
  }

  // Customers & Vendors
  if (q.includes('customer') || q.includes('grahak') || q.includes('client')) {
    suggestedTcodes.push('XD01', 'XD02', 'XD03');
    return {
      reply: `### 👥 Customer Master Management:\n- **Total Customers Registered:** ${dataContext.metrics.totalCustomers}\n\n**Transactions:**\n- **[XD01]**: Create Customer (GSTIN, PAN, Address, Payment terms)\n- **[XD02]**: Change Customer\n- **[XD03]**: Display Customer List`,
      suggestedTcodes
    };
  }

  if (q.includes('vendor') || q.includes('supplier')) {
    suggestedTcodes.push('XK01', 'XK02', 'XK03');
    return {
      reply: `### 🚚 Vendor Master Management:\n- **Total Vendors Registered:** ${dataContext.metrics.totalVendors}\n\n**Transactions:**\n- **[XK01]**: Create Vendor\n- **[XK02]**: Change Vendor\n- **[XK03]**: Display Vendor List`,
      suggestedTcodes
    };
  }

  // Problem / Error / Save / Validation troubleshooting
  if (q.includes('save') || q.includes('error') || q.includes('problem') || q.includes('dikkat') || q.includes('failed') || q.includes('permission') || q.includes('unauthorized')) {
    return {
      reply: `### 🛠️ Troubleshooting Common Sikka LMC Issues:\n\n1. **Invoice not saving?**\n   - Check if **Plant ID** is selected. Every invoice requires a valid Plant ID.\n   - Ensure your user account is assigned to that Plant ID.\n   - Ensure all line items have valid Material, Quantity $> 0$, and Unit Price.\n\n2. **Duplicate Entry Error?**\n   - Plant Code, Firm ID, or Invoice Numbers must be unique.\n   - If editing, verify you are modifying the intended record via change T-Codes (**[OP02]**, **[FM02]**, **[VF02]**).\n\n3. **"Locked" or "Access Denied" on T-Codes?**\n   - Your account permissions are managed in **[SU02]** (Change User Permissions).\n   - Contact your administrator (**ajaysomra**) to assign the required T-Codes to your username.\n\nWhat specific error message are you seeing on screen?`,
      suggestedTcodes: ['SU02', 'DB01', 'VF01']
    };
  }

  // Current screen help
  if (q.includes('screen') || q.includes('page') || q.includes('this') || q.includes('kaise kare') || q.includes('help')) {
    if (dataContext.activeScreen) {
      const code = dataContext.activeScreen.code;
      const title = dataContext.activeScreen.title;
      suggestedTcodes.push(code);
      return {
        reply: `### ℹ️ Help for Current Screen: [${code}] — ${title}\n\nYou are working in transaction **[${code}]**.\n- To execute an action, fill in the mandatory fields (marked with red asterisk) and click the **Save** (💾) icon on the top toolbar or press **Ctrl+S**.\n- To print documents, use the **Print** (🖨️) icon or press **Ctrl+P**.\n- To leave safely, use **Back** (⬅️) or press **F3**.\n\nIf you need specific guidance on the fields of **${title}**, let me know what you want to calculate or enter!`,
        suggestedTcodes
      };
    }
  }

  // Default intelligent fallback with data highlights
  suggestedTcodes.push('DB01', 'VF01', 'FB03', 'OP03');
  return {
    reply: `I understand your question regarding "${message}".\n\n### 🏢 Sikka LMC Live System Summary:\n- **Invoices Recorded:** ${dataContext.metrics.totalInvoices} (Recent: ${dataContext.recentInvoices.length})\n- **Plants:** ${dataContext.metrics.totalPlants} | **Firms:** ${dataContext.metrics.totalFirms}\n- **Materials:** ${dataContext.metrics.totalMaterials} | **Customers:** ${dataContext.metrics.totalCustomers}\n\n**Quick Recommendations:**\n- For Sales Invoices: use **[VF01]** (Create) or **[FB03]** (Payment Status)\n- For Master Data: use **[OP03]** (Plants) or **[FM03]** (Firms)\n- For User Administration: use **[SU02]**\n\nCan you provide more details on what you are trying to find or accomplish? Aap apni problem Hindi ya English me vistaar se batayein.`,
    suggestedTcodes
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { message, history = [], context = {} } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Gather live database context
    const dataContext = await getLiveProjectContext(message, context.currentTcode);

    // 2. Check if Google GenAI / Gemini API key is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (apiKey) {
      try {
        const systemPrompt = `You are the official AI Help & ERP Data Assistant for "Sikka LMC Account Management System".
Your role is to assist enterprise users, accountants, and plant operators with questions about the system's live data, invoices, payments, plants, firms, materials, customers, and SAP transaction codes (T-Codes).

Current Active Screen: ${dataContext.activeScreen ? `[${dataContext.activeScreen.code}] - ${dataContext.activeScreen.title}` : 'Home Dashboard'}
Logged in User: ${context.name || context.username || 'User'} (Role: ${context.role || 'Staff'})

LIVE DATABASE CONTEXT:
- Total Invoices: ${dataContext.metrics.totalInvoices}
- Registered Plants: ${dataContext.plantsSummary.join(', ') || 'None'}
- Registered Firms: ${dataContext.firmsSummary.join(', ') || 'None'}
- Materials Count: ${dataContext.metrics.totalMaterials}
- Customers Count: ${dataContext.metrics.totalCustomers}
- Vendors Count: ${dataContext.metrics.totalVendors}

Recent Invoices Sample:
${JSON.stringify(dataContext.recentInvoices, null, 2)}

Pending Invoices Sample:
${JSON.stringify(dataContext.pendingInvoices, null, 2)}

Targeted Search Data:
${JSON.stringify(dataContext.targetedSearchResults, null, 2)}

GUIDELINES:
1. Ground your answers in the live database context provided above.
2. Whenever you mention a transaction code (e.g., VF01, FB03, OP03, FM01), ALWAYS format it in square brackets like **[VF01]** or **[FB03]** so the frontend can turn it into an interactive clickable navigation link.
3. Understand and respond naturally in the user's language (English, Hindi, or Hinglish).
4. Be polite, clear, structured, and helpful. Use markdown bullet points and bold highlights.
5. If the user asks about an error or why a transaction failed, provide actionable troubleshooting steps (e.g. check plant assignment, mandatory fields, permissions).`;

        const recentHistory = history.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n\n');
        const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${recentHistory}\n\nUser Question: ${message}\nAssistant Answer:`;

        const response = await ai.generate({
          prompt: fullPrompt,
        });

        const replyText = response.text || '';

        // Extract any T-codes mentioned
        const tcodeMatches = replyText.match(/\[([A-Z0-9]{3,6})\]/g) || [];
        const suggestedTcodes = Array.from(
          new Set(tcodeMatches.map(m => m.replace(/\[|\]/g, '')))
        ).filter(c => (TCODE_METADATA as Record<string, string>)[c]);

        return NextResponse.json({
          reply: replyText,
          suggestedTcodes: suggestedTcodes.slice(0, 5),
          isAiGenerated: true
        });
      } catch (genkitError) {
        console.warn('Genkit generation failed, falling back to ERP engine:', genkitError);
      }
    }

    // 3. Built-in Smart ERP Assistant (Offline & Key-less resilient)
    const smartResponse = generateSmartERPResponse(
      message, 
      dataContext, 
      context.currentTcode, 
      context.name || context.username
    );

    return NextResponse.json({
      reply: smartResponse.reply,
      suggestedTcodes: smartResponse.suggestedTcodes,
      isAiGenerated: false
    });

  } catch (error: any) {
    console.error('Error in AI Chat API:', error);
    return NextResponse.json({
      error: 'Failed to process AI chat message',
      details: error.message
    }, { status: 500 });
  }
}
