// Skipper Billing System - Mobile & iOS POS Logic with Multi-User Auth
let cart = [];
let lastCreatedBill = null;
let currentUser = null;

// Auth Elements
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const navAnalyticsBtn = document.querySelector('button[data-tab="tab-analytics"]');

// DOM Elements
const addItemForm = document.getElementById('addItemForm');
const itemNameInput = document.getElementById('itemName');
const itemQtyInput = document.getElementById('itemQty');
const itemPriceInput = document.getElementById('itemPrice');
const itemDiscountInput = document.getElementById('itemDiscount');
const cartTableBody = document.getElementById('cartTableBody');
const cartCount = document.getElementById('cartCount');
const clearCartBtn = document.getElementById('clearCartBtn');

const summarySubtotal = document.getElementById('summarySubtotal');
const taxRateSelect = document.getElementById('taxRateSelect');
const summaryTaxAmount = document.getElementById('summaryTaxAmount');
const billDiscountInput = document.getElementById('billDiscountInput');
const summaryGrandTotal = document.getElementById('summaryGrandTotal');

const custName = document.getElementById('custName');
const custPhone = document.getElementById('custPhone');
const custEmail = document.getElementById('custEmail');
const billNotes = document.getElementById('billNotes');
const submitBillBtn = document.getElementById('submitBillBtn');

// Modal Elements
const billSuccessModal = document.getElementById('billSuccessModal');
const modalInvoiceNo = document.getElementById('modalInvoiceNo');
const modalGrandTotal = document.getElementById('modalGrandTotal');
const modalCustomerName = document.getElementById('modalCustomerName');
const modalWhatsAppBtn = document.getElementById('modalWhatsAppBtn');
const modalPrintBtn = document.getElementById('modalPrintBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalWaPreviewText = document.getElementById('modalWaPreviewText');

// ==========================================
// 🔐 AUTHENTICATION & ROLE-BASED ACCESS
// ==========================================

function checkAuth() {
  const saved = localStorage.getItem('skipper_pos_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
    } catch (e) {
      currentUser = null;
    }
  }

  if (!currentUser) {
    loginModal.classList.add('show');
    if (navAnalyticsBtn) navAnalyticsBtn.style.display = 'none';
    if (userNameDisplay) userNameDisplay.textContent = '🔒 Not Signed In';
    return false;
  }

  // User is authenticated
  loginModal.classList.remove('show');

  const roleIcon = currentUser.role === 'admin' ? '👑' : '🛍️';
  if (userNameDisplay) {
    userNameDisplay.textContent = `${roleIcon} ${currentUser.name} (${currentUser.role.toUpperCase()})`;
  }

  // Role permissions
  if (currentUser.role === 'admin') {
    if (navAnalyticsBtn) navAnalyticsBtn.style.display = 'flex';
  } else {
    // Cashier: hide sensitive store revenue analytics
    if (navAnalyticsBtn) navAnalyticsBtn.style.display = 'none';
  }

  return true;
}

// Login Handler
async function performLogin(username, password) {
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem('skipper_pos_user', JSON.stringify(currentUser));
      showToast(data.message || 'Login successful!', 'success');
      checkAuth();
      loginForm.reset();
      itemNameInput.focus();
    } else {
      showToast(data.message || 'Authentication failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication service', 'error');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = '🔐 Sign In to Terminal';
  }
}

// Submit Login Form
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  performLogin(loginUsernameInput.value.trim(), loginPasswordInput.value);
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
  if (confirm('Sign out of the billing register?')) {
    localStorage.removeItem('skipper_pos_user');
    currentUser = null;
    showToast('Logged out successfully', 'success');
    checkAuth();
  }
});

// Initial auth check on load
checkAuth();

// ==========================================
// 🔔 AUDIO & INTERACTIVE POS LOGIC
// ==========================================

// Web Audio Cash Register Chime
function playCashChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc1.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start(ctx.currentTime + 0.1);
    osc1.stop(ctx.currentTime + 0.55);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {}
}

// Live Clock
function updateClock() {
  const clockEl = document.getElementById('liveClock');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
  }
}
setInterval(updateClock, 1000);
updateClock();

// Tab Navigation
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!checkAuth()) return;

    const tabId = btn.getAttribute('data-tab');

    // Protect Analytics tab for admin only
    if (tabId === 'tab-analytics' && currentUser.role !== 'admin') {
      showToast('Admin privilege required for store analytics', 'error');
      return;
    }

    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));

    btn.classList.add('active');
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    if (tabId === 'tab-history') {
      loadHistory();
    } else if (tabId === 'tab-analytics') {
      loadAnalytics();
    }
  });
});

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

// Payment method button styling
document.querySelectorAll('.pay-btn').forEach((label) => {
  label.addEventListener('click', () => {
    document.querySelectorAll('.pay-btn').forEach((l) => l.classList.remove('active'));
    label.classList.add('active');
  });
});

// Add Item
addItemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!checkAuth()) return;

  const name = itemNameInput.value.trim();
  const quantity = Math.max(1, parseInt(itemQtyInput.value, 10) || 1);
  const unitPrice = Math.max(0, parseFloat(itemPriceInput.value) || 0);
  const discount = Math.max(0, parseFloat(itemDiscountInput.value) || 0);

  if (!name) return;

  const total = Math.max(0, quantity * unitPrice - discount);

  cart.push({
    name,
    quantity,
    unitPrice,
    discount,
    total,
  });

  renderCart();

  // Reset inputs
  itemNameInput.value = '';
  itemQtyInput.value = '1';
  itemPriceInput.value = '';
  itemDiscountInput.value = '0';
  itemNameInput.focus();
});

// Remove item
window.removeCartItem = (index) => {
  cart.splice(index, 1);
  renderCart();
};

// Adjust quantity
window.updateItemQty = (index, delta) => {
  if (cart[index]) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].total = Math.max(
        0,
        cart[index].quantity * cart[index].unitPrice - cart[index].discount
      );
    }
    renderCart();
  }
};

// Clear cart
clearCartBtn.addEventListener('click', () => {
  if (cart.length > 0 && confirm('Clear all items from this bill?')) {
    cart = [];
    renderCart();
  }
});

// Recalculate Totals
function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseFloat(taxRateSelect.value) || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const billDiscount = parseFloat(billDiscountInput.value) || 0;
  const grandTotal = Math.max(0, subtotal + taxAmount - billDiscount);

  summarySubtotal.textContent = `₹${subtotal.toFixed(2)}`;
  summaryTaxAmount.textContent = `₹${taxAmount.toFixed(2)}`;
  summaryGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;

  return { subtotal, taxRate, taxAmount, billDiscount, grandTotal };
}

taxRateSelect.addEventListener('change', calculateTotals);
billDiscountInput.addEventListener('input', calculateTotals);

// Render Cart Table
function renderCart() {
  cartCount.textContent = cart.length;

  if (cart.length === 0) {
    cartTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">No items added yet. Type an item above to start billing.</td>
      </tr>`;
    calculateTotals();
    return;
  }

  cartTableBody.innerHTML = cart
    .map(
      (item, idx) => `
      <tr>
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td style="text-align: center;">
          <div class="qty-control">
            <button class="qty-btn" type="button" onclick="updateItemQty(${idx}, -1)">-</button>
            <span style="font-weight: 700; min-width: 22px;">${item.quantity}</span>
            <button class="qty-btn" type="button" onclick="updateItemQty(${idx}, 1)">+</button>
          </div>
        </td>
        <td style="text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
        <td style="text-align: right;">₹${item.discount.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 800; color: #1a56db;">₹${item.total.toFixed(2)}</td>
        <td style="text-align: center;">
          <button class="del-btn" type="button" onclick="removeCartItem(${idx})">🗑️</button>
        </td>
      </tr>`
    )
    .join('');

  calculateTotals();
}

// Generate Creative WhatsApp Message String
function buildWhatsAppMessage(bill) {
  const itemsText = bill.items
    .map((it) => `• ${it.name} (x${it.quantity}) - ₹${it.total.toFixed(2)}`)
    .join('\n');

  const rewardPoints = Math.round(bill.grandTotal / 10);
  const billedByStr = bill.billedBy ? `👤 *Cashier:* ${bill.billedBy}\n` : '';

  return (
`✨ *SKIPPER STORE - DIGITAL INVOICE* ✨
━━━━━━━━━━━━━━━━━━
Hello *${bill.customer.name}*! 👋
Thank you for shopping with us today. Here is your official e-bill copy:

🧾 *Invoice #:* ${bill.invoiceNumber}
📅 *Date:* ${new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN')}
${billedByStr}💳 *Payment Mode:* ${bill.paymentMethod}

🛍️ *Purchased Items:*
${itemsText}

━━━━━━━━━━━━━━━━━━
💰 *Subtotal:* ₹${bill.subtotal.toFixed(2)}
${bill.taxRate > 0 ? `📊 *Tax (${bill.taxRate}%):* ₹${bill.taxAmount.toFixed(2)}\n` : ''}${bill.discount > 0 ? `🏷️ *Special Discount:* -₹${bill.discount.toFixed(2)}\n` : ''}💎 *Grand Total:* *₹${bill.grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━
🎁 *EXCLUSIVE LOYALTY REWARD:*
🌟 You just earned *${rewardPoints} Skipper Points*!
Show this bill on your next visit to receive a *complimentary 5% OFF*! ☕🎉

*"Your smile is our greatest receipt. Thank you and visit us again soon!"* ❤️
━━━━━━━━━━━━━━━━━━`
  );
}

// Build WhatsApp Web/App URL
function getWhatsAppUrl(phone, message) {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

// Submit Bill
submitBillBtn.addEventListener('click', async () => {
  if (!checkAuth()) return;

  if (cart.length === 0) {
    showToast('Please add at least one item to bill', 'error');
    return;
  }

  const { taxRate, billDiscount } = calculateTotals();
  const selectedPayment = document.querySelector('input[name="payMethod"]:checked')?.value || 'Cash';

  const customerPhone = custPhone.value.trim();
  const customerName = custName.value.trim() || 'Walk-in Customer';

  const payload = {
    customer: {
      name: customerName,
      phone: customerPhone,
      email: custEmail.value.trim(),
    },
    items: cart,
    taxRate,
    discount: billDiscount,
    paymentMethod: selectedPayment,
    notes: billNotes.value.trim(),
    billedBy: currentUser ? currentUser.name : 'Store Cashier',
  };

  submitBillBtn.disabled = true;
  submitBillBtn.textContent = 'Generating...';

  try {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success && data.data) {
      const bill = data.data;
      lastCreatedBill = bill;

      // Play joyful chime
      playCashChime();
      showToast(`Bill ${bill.invoiceNumber} generated!`, 'success');

      // Populate Success Modal
      modalInvoiceNo.textContent = bill.invoiceNumber;
      modalGrandTotal.textContent = `₹${bill.grandTotal.toFixed(2)}`;
      modalCustomerName.textContent = `Billed to: ${bill.customer.name} ${bill.customer.phone ? `(${bill.customer.phone})` : ''} • By ${bill.billedBy || 'Staff'}`;

      const waMsg = buildWhatsAppMessage(bill);
      const waUrl = getWhatsAppUrl(bill.customer.phone, waMsg);

      modalWhatsAppBtn.href = waUrl;
      modalPrintBtn.href = `/api/bills/${bill._id}/print`;
      modalWaPreviewText.textContent = `Total ₹${bill.grandTotal.toFixed(2)} with loyalty rewards ready to send!`;

      // Show modal
      billSuccessModal.classList.add('show');

      // Reset cart and fields
      cart = [];
      renderCart();
      custName.value = 'Walk-in Customer';
      custPhone.value = '';
      custEmail.value = '';
      billNotes.value = '';
      billDiscountInput.value = '0';
    } else {
      showToast(data.message || 'Error creating bill', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to server', 'error');
  } finally {
    submitBillBtn.disabled = false;
    submitBillBtn.textContent = '⚡ Generate Bill & Share';
  }
});

// Close Modal
modalCloseBtn.addEventListener('click', () => {
  billSuccessModal.classList.remove('show');
  itemNameInput.focus();
});

// History & WhatsApp Sharing
async function loadHistory() {
  const search = document.getElementById('historySearchInput').value.trim();
  const status = document.getElementById('historyStatusFilter').value;
  const historyTableBody = document.getElementById('historyTableBody');

  let url = '/api/bills?limit=50';
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    if (!result.success || !result.data || result.data.length === 0) {
      historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">No invoices found.</td>
        </tr>`;
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';

    historyTableBody.innerHTML = result.data
      .map((bill) => {
        const date = new Date(bill.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const statusClass =
          bill.status === 'paid' ? 'status-paid' : bill.status === 'pending' ? 'status-pending' : 'status-cancelled';

        const waMsg = buildWhatsAppMessage(bill);
        const waUrl = getWhatsAppUrl(bill.customer.phone, waMsg);

        const deleteButtonHtml = isAdmin
          ? `<button onclick="deleteBill('${bill._id}')" class="del-btn" style="margin-left: 4px;" title="Delete Bill">🗑️</button>`
          : '';

        return `
        <tr>
          <td><strong>${bill.invoiceNumber}</strong></td>
          <td>
            ${date}
            ${bill.billedBy ? `<br><small style="color:#64748b; font-weight:600;">By: ${bill.billedBy}</small>` : ''}
          </td>
          <td>
            <strong>${bill.customer.name}</strong>
            ${bill.customer.phone ? `<br><small style="color:#64748b">📱 ${bill.customer.phone}</small>` : ''}
          </td>
          <td>${bill.paymentMethod}</td>
          <td>${bill.items.length} item(s)</td>
          <td style="text-align: right; font-weight: 800;">₹${bill.grandTotal.toFixed(2)}</td>
          <td style="text-align: center;">
            <span class="status-badge ${statusClass}">${bill.status}</span>
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="padding: 4px 10px; height: 32px; font-size: 12px;">💬 WhatsApp</a>
            <a href="/api/bills/${bill._id}/print" target="_blank" class="btn btn-outline" style="padding: 4px 10px; height: 32px; font-size: 12px;">🖨️</a>
            ${deleteButtonHtml}
          </td>
        </tr>`;
      })
      .join('');
  } catch (err) {
    console.error(err);
    historyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">Failed to load invoices. Ensure backend is running.</td>
      </tr>`;
  }
}

// Delete Bill (Admin only)
window.deleteBill = async (id) => {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Only admins can delete bills', 'error');
    return;
  }

  if (!confirm('Are you sure you want to delete this invoice?')) return;

  try {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Bill deleted successfully');
      loadHistory();
    } else {
      showToast(data.message || 'Failed to delete bill', 'error');
    }
  } catch (err) {
    showToast('Server error', 'error');
  }
};

document.getElementById('historySearchInput').addEventListener('input', () => {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(loadHistory, 400);
});
document.getElementById('historyStatusFilter').addEventListener('change', loadHistory);
document.getElementById('refreshHistoryBtn').addEventListener('click', loadHistory);

// Analytics (Admin only)
async function loadAnalytics() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Admin privilege required', 'error');
    return;
  }

  try {
    const res = await fetch('/api/bills/stats');
    const result = await res.json();

    if (!result.success || !result.data) return;

    const { overall, byPaymentMethod, byStatus } = result.data;

    document.getElementById('statTotalRevenue').textContent = `₹${(overall.totalRevenue || 0).toFixed(2)}`;
    document.getElementById('statTotalBills').textContent = overall.totalBills || 0;
    document.getElementById('statAvgValue').textContent = `₹${(overall.avgBillValue || 0).toFixed(2)}`;

    // Breakdown lists
    const paymentEl = document.getElementById('paymentBreakdownList');
    if (byPaymentMethod && byPaymentMethod.length > 0) {
      paymentEl.innerHTML = byPaymentMethod
        .map(
          (p) => `
          <div class="breakdown-item">
            <span><strong>${p._id || 'Unspecified'}</strong> (${p.count} bills)</span>
            <strong>₹${(p.total || 0).toFixed(2)}</strong>
          </div>`
        )
        .join('');
    } else {
      paymentEl.innerHTML = `<p class="empty-text">No payment breakdown available yet.</p>`;
    }

    const statusEl = document.getElementById('statusBreakdownList');
    if (byStatus && byStatus.length > 0) {
      statusEl.innerHTML = byStatus
        .map(
          (s) => `
          <div class="breakdown-item">
            <span style="text-transform: capitalize;"><strong>${s._id || 'Draft'}</strong> (${s.count} bills)</span>
            <strong>₹${(s.total || 0).toFixed(2)}</strong>
          </div>`
        )
        .join('');
    } else {
      statusEl.innerHTML = `<p class="empty-text">No status breakdown available yet.</p>`;
    }
  } catch (err) {
    console.error('Analytics load error:', err);
  }
}
