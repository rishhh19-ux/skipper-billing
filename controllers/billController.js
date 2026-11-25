const Bill = require('../models/Bill');

// Helper to generate a unique invoice number
const generateInvoiceNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await Bill.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${dateStr}-${sequence}`;
};

// Create a new bill
exports.createBill = async (req, res) => {
  try {
    const {
      invoiceNumber,
      customer,
      items,
      taxRate = 0,
      discount = 0,
      paymentMethod = 'Cash',
      status = 'paid',
      notes = '',
      billedBy = 'Admin',
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // Process and calculate each line item
    const processedItems = items.map((item) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const itemDisc = Number(item.discount) || 0;
      const lineTotal = Math.max(0, qty * price - itemDisc);

      return {
        name: item.name,
        quantity: qty,
        unitPrice: price,
        discount: itemDisc,
        total: Math.round(lineTotal * 100) / 100,
      };
    });

    const subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = Math.round(((subtotal * Number(taxRate)) / 100) * 100) / 100;
    const totalDiscount = Number(discount) || 0;
    const grandTotal = Math.max(0, Math.round((subtotal + taxAmount - totalDiscount) * 100) / 100);

    const generatedNumber = invoiceNumber || (await generateInvoiceNumber());

    const newBill = new Bill({
      invoiceNumber: generatedNumber,
      customer: {
        name: customer?.name || 'Walk-in Customer',
        phone: customer?.phone || '',
        email: customer?.email || '',
        address: customer?.address || '',
      },
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxRate: Number(taxRate),
      taxAmount,
      discount: totalDiscount,
      grandTotal,
      paymentMethod,
      status,
      notes,
      billedBy,
    });

    const savedBill = await newBill.save();
    return res.status(201).json({ success: true, data: savedBill });
  } catch (error) {
    console.error('Error creating bill:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all bills with search, filter, and pagination
exports.getAllBills = async (req, res) => {
  try {
    const { search, status, paymentMethod, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [bills, total] = await Promise.all([
      Bill.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Bill.countDocuments(query),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: bills,
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single bill by ID or invoice number
exports.getBillById = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = id.match(/^[0-9a-fA-F]{24}$/)
      ? await Bill.findById(id)
      : await Bill.findOne({ invoiceNumber: id });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    return res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching bill:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing bill
exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.items || updates.taxRate !== undefined || updates.discount !== undefined) {
      const existing = await Bill.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }

      const items = updates.items || existing.items;
      const taxRate = updates.taxRate !== undefined ? Number(updates.taxRate) : existing.taxRate;
      const discount = updates.discount !== undefined ? Number(updates.discount) : existing.discount;

      const processedItems = items.map((item) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        const itemDisc = Number(item.discount) || 0;
        return {
          name: item.name,
          quantity: qty,
          unitPrice: price,
          discount: itemDisc,
          total: Math.round(Math.max(0, qty * price - itemDisc) * 100) / 100,
        };
      });

      const subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
      const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const grandTotal = Math.max(0, Math.round((subtotal + taxAmount - discount) * 100) / 100);

      updates.items = processedItems;
      updates.subtotal = Math.round(subtotal * 100) / 100;
      updates.taxAmount = taxAmount;
      updates.grandTotal = grandTotal;
    }

    const updated = await Bill.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating bill:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete / Void a bill
exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Bill.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    return res.json({ success: true, message: 'Bill deleted successfully', data: deleted });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Summary metrics / dashboard analytics
exports.getStats = async (req, res) => {
  try {
    const stats = await Bill.aggregate([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$grandTotal' },
                totalBills: { $sum: 1 },
                avgBillValue: { $avg: '$grandTotal' },
              },
            },
          ],
          byPaymentMethod: [
            {
              $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                total: { $sum: '$grandTotal' },
              },
            },
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                total: { $sum: '$grandTotal' },
              },
            },
          ],
        },
      },
    ]);

    const result = {
      overall: stats[0].overall[0] || { totalRevenue: 0, totalBills: 0, avgBillValue: 0 },
      byPaymentMethod: stats[0].byPaymentMethod,
      byStatus: stats[0].byStatus,
    };

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching bill stats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Printable & Shareable HTML invoice
exports.getInvoiceHtml = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = id.match(/^[0-9a-fA-F]{24}$/)
      ? await Bill.findById(id)
      : await Bill.findOne({ invoiceNumber: id });

    if (!bill) {
      return res.status(404).send('<h2>Invoice not found</h2>');
    }

    const itemsHtml = bill.items
      .map(
        (item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${item.name}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
          <td style="text-align: right;">₹${item.discount.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 600;">₹${item.total.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const formattedDate = new Date(bill.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Formatted items for WhatsApp message
    const waItemsList = bill.items
      .map((it) => `• ${it.name} (x${it.quantity}) - ₹${it.total.toFixed(2)}`)
      .join('%0A');

    // Creative WhatsApp message
    const waText = encodeURIComponent(
`✨ *SKIPPER STORE - DIGITAL INVOICE* ✨
━━━━━━━━━━━━━━━━━━
Hello *${bill.customer.name}*! 👋
Thank you for shopping with us today. Here is your official e-bill copy:

🧾 *Invoice #:* ${bill.invoiceNumber}
📅 *Date:* ${formattedDate}
💳 *Payment Mode:* ${bill.paymentMethod}

🛍️ *Purchased Items:*
${bill.items.map((it) => `• ${it.name} (x${it.quantity}) - ₹${it.total.toFixed(2)}`).join('\n')}

━━━━━━━━━━━━━━━━━━
💰 *Subtotal:* ₹${bill.subtotal.toFixed(2)}
${bill.taxRate > 0 ? `📊 *Tax (${bill.taxRate}%):* ₹${bill.taxAmount.toFixed(2)}\n` : ''}${bill.discount > 0 ? `🏷️ *Special Discount:* -₹${bill.discount.toFixed(2)}\n` : ''}💎 *Grand Total:* *₹${bill.grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━
🎁 *EXCLUSIVE LOYALTY PERK:*
🌟 You earned *${Math.round(bill.grandTotal / 10)} Skipper Reward Points*!
Show this bill message on your next visit to receive a *complimentary 5% OFF*! ☕🎉

*"Your smile is our greatest receipt. Thank you and visit us again soon!"* ❤️
━━━━━━━━━━━━━━━━━━`
    );

    // Clean phone number for WhatsApp wa.me link
    let cleanPhone = (bill.customer.phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Default to India (+91) if 10-digit
    }
    const waLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${waText}`
      : `https://api.whatsapp.com/send?text=${waText}`;

    // Dynamic QR code showing the bill verification URL
    const qrData = encodeURIComponent(`https://${req.get('host')}/api/bills/${bill._id}/print`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Invoice - ${bill.invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body { background: #f0f2f5; padding: 20px; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .invoice-card {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px dashed #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 22px;
    }
    .brand h1 { font-size: 26px; color: #1a56db; font-weight: 800; letter-spacing: -0.5px; }
    .brand p { font-size: 13px; color: #64748b; margin-top: 3px; }
    .meta { text-align: right; }
    .meta .inv-no { font-size: 17px; font-weight: 800; color: #0f172a; }
    .meta .date { font-size: 12px; color: #64748b; margin-top: 4px; }
    .badge-paid {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #dcfce7;
      color: #15803d;
    }
    .badge-pending {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #fef9c3;
      color: #854d0e;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 22px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
    }
    .info-block h4 { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 5px; }
    .info-block p { font-size: 14px; color: #0f172a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      padding: 10px 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 20px;
    }
    .qr-container {
      background: #f8fafc;
      padding: 14px;
      border-radius: 12px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .qr-container img { width: 100px; height: 100px; display: block; margin: 0 auto; }
    .qr-container span { font-size: 10px; font-weight: 600; color: #64748b; display: block; margin-top: 6px; }
    .summary-table { width: 280px; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 13px;
      color: #475569;
    }
    .summary-row.total {
      border-top: 2px solid #0f172a;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 18px;
      font-weight: 800;
      color: #1a56db;
    }
    /* Creative Thank You Card */
    .creative-card {
      background: linear-gradient(135deg, #fdf4ff 0%, #ede9fe 100%);
      border: 1px dashed #c084fc;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 22px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .creative-icon { font-size: 32px; }
    .creative-text h4 { font-size: 14px; font-weight: 700; color: #6b21a8; margin-bottom: 3px; }
    .creative-text p { font-size: 12px; color: #7e22ce; line-height: 1.4; }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    /* Floating action buttons */
    .actions-bar {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 24px;
      position: sticky;
      bottom: 20px;
    }
    .btn {
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      transition: transform 0.15s, opacity 0.15s;
    }
    .btn:active { transform: scale(0.97); }
    .btn-print { background: #1a56db; }
    .btn-whatsapp { background: #25d366; }
    .btn-whatsapp:hover { background: #20bd5a; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { box-shadow: none; border-radius: 0; padding: 15px; max-width: 100%; }
      .actions-bar { display: none !important; }
      .qr-container { border: none; }
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .invoice-card { padding: 18px; }
      .summary-section { flex-direction: column-reverse; align-items: stretch; }
      .summary-table { width: 100%; }
      .qr-container { margin-bottom: 12px; }
      .actions-bar { flex-direction: column; }
      .btn { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="brand">
        <h1>SKIPPER STORE ⚡</h1>
        <p>Premium Retail & Smart Billing</p>
      </div>
      <div class="meta">
        <div class="inv-no">${bill.invoiceNumber}</div>
        <div class="date">${formattedDate}</div>
        <div>
          <span class="${bill.status === 'paid' ? 'badge-paid' : 'badge-pending'}">${bill.status}</span>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <h4>Billed To:</h4>
        <p>${bill.customer.name}</p>
        ${bill.customer.phone ? `<p style="font-size: 12px; color: #64748b; font-weight: 500;">📱 ${bill.customer.phone}</p>` : ''}
        ${bill.customer.email ? `<p style="font-size: 12px; color: #64748b; font-weight: 500;">✉️ ${bill.customer.email}</p>` : ''}
      </div>
      <div class="info-block" style="text-align: right;">
        <h4>Payment Mode:</h4>
        <p>${bill.paymentMethod}</p>
        ${bill.notes ? `<h4 style="margin-top: 8px;">Notes:</h4><p style="font-size: 12px; color: #64748b; font-weight: 500;">${bill.notes}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          <th>Item Description</th>
          <th style="width: 50px; text-align: center;">Qty</th>
          <th style="width: 90px; text-align: right;">Rate</th>
          <th style="width: 70px; text-align: right;">Disc</th>
          <th style="width: 100px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="qr-container">
        <img src="${qrUrl}" alt="Invoice QR" />
        <span>Scan for E-Bill</span>
      </div>

      <div class="summary-table">
        <div class="summary-row">
          <span>Subtotal</span>
          <span>₹${bill.subtotal.toFixed(2)}</span>
        </div>
        ${bill.taxRate > 0 ? `
        <div class="summary-row">
          <span>GST / Tax (${bill.taxRate}%)</span>
          <span>₹${bill.taxAmount.toFixed(2)}</span>
        </div>` : ''}
        ${bill.discount > 0 ? `
        <div class="summary-row">
          <span>Special Discount</span>
          <span>-₹${bill.discount.toFixed(2)}</span>
        </div>` : ''}
        <div class="summary-row total">
          <span>Grand Total</span>
          <span>₹${bill.grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Creative Thank You & Loyalty Card -->
    <div class="creative-card">
      <div class="creative-icon">🎁</div>
      <div class="creative-text">
        <h4>Thank you for visiting Skipper Store!</h4>
        <p>You've earned <strong>${Math.round(bill.grandTotal / 10)} Skipper Reward Points</strong> on this visit! Show this digital bill on your next stop for a special <strong>5% surprise discount</strong>. We look forward to seeing you again soon!</p>
      </div>
    </div>

    <div class="footer">
      <p>⭐ "Your smile is our greatest receipt. Have a wonderful day!" ⭐</p>
    </div>
  </div>

  <div class="actions-bar">
    <a href="${waLink}" target="_blank" class="btn btn-whatsapp">
      💬 Send to Customer's WhatsApp
    </a>
    <button class="btn btn-print" onclick="window.print()">
      🖨️ Print Invoice
    </button>
  </div>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    console.error('Error generating invoice HTML:', error);
    return res.status(500).send('<h2>Error loading invoice</h2>');
  }
};
