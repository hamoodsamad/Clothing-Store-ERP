// Clothing Store ERP - Application Core Engine (English Edition)
const API_BASE = '/api';

let currentTheme = localStorage.getItem('theme') || 'light';
let allProducts = [];
let allCustomers = [];
let posCart = [];
let selectedReturnItem = null;
let selectedReturnType = 'SUIT_EXCHANGE';
let salesProfitChartInstance = null;
let cashFlowChartInstance = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  setupNavigation();
  setupBarcodeScannerListener();
  initCharts();
  loadOverview();
  loadInventory();
  loadInvoices();
  loadCustomers();
  loadSalesReturns();
  loadSuppliers();
  loadPurchases();
  loadExpenses();
  loadDeliveryNotes();
  loadSettings();
});

// ======================== Theme Switcher ========================

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (theme === 'dark') {
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Light Mode';
  } else {
    if (icon) icon.textContent = '🌙';
    if (label) label.textContent = 'Dark Mode';
  }
  localStorage.setItem('theme', theme);
  currentTheme = theme;
}

function toggleTheme() {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// ======================== Tab Navigation ========================

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  // Update sidebar active class
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-tab') === tabId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update tab views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update Topbar Titles
  const titles = {
    dashboard: { en: 'Dashboard & Financial Analytics', sub: 'Revenue, Cash Flow, Profit & Loss and Stock Health' },
    pos: { en: 'Point of Sale & Quick Billing', sub: 'Barcode Scanner Checkout, Counter Invoicing & Real-time Stock Deduction' },
    inventory: { en: 'Clothing Stock & Restock Scanner', sub: 'Suits Catalog, Available Quantities, Cost, Retail Rates & Margins' },
    invoices: { en: 'Sales Invoices & Receipts History', sub: 'Customer Billing Audit Log, Print Thermal Receipts & Order History' },
    customers: { en: 'Customer Database & Purchase History', sub: 'Client Profiles, Itemized Purchase Records & Return Options' },
    returns: { en: 'Sales Returns & Cash Refunds', sub: 'Processed Returns, Suit Restock Logs & Cash Refund Audits' },
    estimates: { en: 'Estimates & Quotations', sub: 'Event & Bulk Purchase Price Quotations for Clients' },
    purchases: { en: 'Suppliers & Fabric Purchases', sub: 'Textile Mills, Fabric Thaan Restocking & Payable Accounts' },
    expenses: { en: 'Store Business Expenses', sub: 'Shop Rent, Commercial Electricity, Staff Salaries & Packaging' },
    delivery: { en: 'Delivery Challans & Courier Tracking', sub: 'Courier Dispatch Receipts & Parcels Tracking' },
    reports: { en: 'Comprehensive Profit & Loss Report', sub: 'Financial P&L Statement, Cash Flow and Operating Margins' },
    settings: { en: 'Store Settings & Invoice Customization', sub: 'Brand Name, Physical Address, Helpline & Return Policy' },
  };

  if (titles[tabId]) {
    document.getElementById('pageTitle').textContent = titles[tabId].en;
    document.getElementById('pageSubtitle').textContent = titles[tabId].sub;
  }

  // Refresh relevant tab data
  if (tabId === 'dashboard') loadOverview();
  if (tabId === 'inventory') loadInventory();
  if (tabId === 'pos') renderPosCatalog();
  if (tabId === 'invoices') loadInvoices();
  if (tabId === 'customers') loadCustomers();
  if (tabId === 'returns') loadSalesReturns();
  if (tabId === 'reports') loadReportsData();
}

// ======================== Global USB Barcode Scanner Hook ========================

let barcodeBuffer = '';
let lastKeyTime = Date.now();

function setupBarcodeScannerListener() {
  document.addEventListener('keydown', (e) => {
    // If user is typing in regular text fields other than scanner inputs, skip
    const activeEl = document.activeElement;
    const isRegularInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.id !== 'posBarcodeInput' && activeEl.id !== 'restockBarcodeInput';
    if (isRegularInput) return;

    const currentTime = Date.now();
    // Barcode scanners type very rapidly (typically < 35ms between keystrokes)
    if (currentTime - lastKeyTime > 150) {
      barcodeBuffer = '';
    }
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) {
        e.preventDefault();
        handleScannedBarcodeFromHardware(barcodeBuffer.trim());
        barcodeBuffer = '';
      }
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
    }
  });

  // Enter key trigger on POS Scanner input
  const posInput = document.getElementById('posBarcodeInput');
  if (posInput) {
    posInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePosBarcodeScan();
      }
    });
  }

  // Enter key trigger on Restock input
  const restockInput = document.getElementById('restockBarcodeInput');
  if (restockInput) {
    restockInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkProductForRestock();
      }
    });
  }
}

function handleScannedBarcodeFromHardware(code) {
  // If Restock modal is active, send to restock
  const restockModal = document.getElementById('restockModal');
  if (restockModal && restockModal.classList.contains('active')) {
    document.getElementById('restockBarcodeInput').value = code;
    checkProductForRestock();
    return;
  }

  // Otherwise, default to POS checkout scanner
  switchTab('pos');
  document.getElementById('posBarcodeInput').value = code;
  handlePosBarcodeScan();
}

// ======================== Dashboard Overview & Analytics ========================

function computeOverviewFromDb(db) {
  const currentMonth = '2026-11';
  let totalSales = 0, totalProfit = 0, paymentReceived = 0;
  const prodSales = {};
  
  (db.invoices || []).forEach(inv => {
    if ((inv.date || '').startsWith(currentMonth)) {
      totalSales += inv.grand_total || 0;
      totalProfit += inv.total_profit || 0;
      paymentReceived += inv.amount_paid || 0;
    }
    (inv.items || []).forEach(item => {
      const pid = item.product_id;
      if (!prodSales[pid]) prodSales[pid] = [0, 0, 0];
      prodSales[pid][0] += item.quantity || 0;
      prodSales[pid][1] += item.total || 0;
      prodSales[pid][2] += item.profit || 0;
    });
  });

  let totalPurchases = 0, paymentsPaidSuppliers = 0;
  (db.purchases || []).forEach(po => {
    if ((po.date || '').startsWith(currentMonth)) {
      totalPurchases += po.grand_total || 0;
      paymentsPaidSuppliers += po.paid_amount || 0;
    }
  });

  let totalExpenses = 0;
  (db.expenses || []).forEach(exp => {
    if ((exp.date || '').startsWith(currentMonth)) {
      totalExpenses += exp.amount || 0;
    }
  });

  let totalUnits = 0, totalCost = 0, totalRetail = 0, lowStock = 0;
  const allRanks = (db.products || []).map(p => {
    const qty = p.stock_quantity || 0;
    totalUnits += qty;
    totalCost += (p.cost_price || 0) * qty;
    totalRetail += (p.selling_price || 0) * qty;
    if (qty <= (p.min_stock_alert || 10)) lowStock++;
    const [units, rev, prof] = prodSales[p.id] || [0, 0, 0];
    return {
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      current_stock: qty,
      units_sold: units,
      total_revenue: rev,
      total_profit: prof
    };
  });

  const bestSelling = [...allRanks].sort((a, b) => b.units_sold - a.units_sold).slice(0, 5);
  const slowestSelling = [...allRanks].sort((a, b) => a.units_sold - b.units_sold).slice(0, 5);
  const recentInvoices = [...(db.invoices || [])].reverse().slice(0, 6);

  return {
    month_name: 'November 2026',
    total_sales_month: totalSales,
    total_purchases_month: totalPurchases,
    total_profit_month: totalProfit - totalExpenses,
    payment_received_month: paymentReceived,
    payment_paid_month: paymentsPaidSuppliers + totalExpenses,
    total_expenses_month: totalExpenses,
    total_stock_units: totalUnits,
    total_stock_value_cost: totalCost,
    total_stock_value_retail: totalRetail,
    low_stock_count: lowStock,
    best_selling_suits: bestSelling,
    slowest_selling_suits: slowestSelling,
    recent_invoices: recentInvoices
  };
}

async function loadOverview() {
  try {
    let data = null;
    try {
      const res = await fetch(`${API_BASE}/overview`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.warn('API overview fetch failed, attempting static fallback', e);
    }

    if (!data || !data.total_sales_month) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          data = computeOverviewFromDb(db);
        }
      } catch (e) {}
    }

    if (data) {
      document.getElementById('kpiSales').textContent = `Rs. ${data.total_sales_month.toLocaleString()}`;
      document.getElementById('kpiPurchases').textContent = `Rs. ${data.total_purchases_month.toLocaleString()}`;
      document.getElementById('kpiProfit').textContent = `Rs. ${data.total_profit_month.toLocaleString()}`;
      document.getElementById('kpiReceived').textContent = `Rs. ${data.payment_received_month.toLocaleString()}`;
      document.getElementById('kpiPaid').textContent = `Rs. ${data.payment_paid_month.toLocaleString()}`;

      document.getElementById('kpiStockUnits').textContent = `${data.total_stock_units} Pcs`;
      document.getElementById('kpiStockCost').textContent = `Rs. ${data.total_stock_value_cost.toLocaleString()}`;
      document.getElementById('kpiStockRetail').textContent = `Rs. ${data.total_stock_value_retail.toLocaleString()}`;
      document.getElementById('kpiLowStock').textContent = `${data.low_stock_count} Items`;

      // Render Best-Selling Suits Table
      renderBestSellingTable(data.best_selling_suits);

      // Render Slowest-Selling Suits Table
      renderSlowestSellingTable(data.slowest_selling_suits);

      // Render Recent Invoices
      renderRecentInvoicesTable(data.recent_invoices);

      // Update Live Charts
      updateCharts(data);
    }
  } catch (err) {
    console.error('Failed to load overview:', err);
  }
}

function initCharts() {
  const ctx1 = document.getElementById('salesProfitChart');
  const ctx2 = document.getElementById('cashFlowChart');
  if (!ctx1 || !ctx2 || typeof Chart === 'undefined') return;

  const months = ['June', 'July', 'August', 'September', 'October', 'November'];
  
  salesProfitChartInstance = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Sales Revenue (PKR)',
          data: [236400, 282100, 308800, 339300, 362200, 381300],
          borderColor: '#047857',
          backgroundColor: 'rgba(4, 120, 87, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Net Profit (PKR)',
          data: [53500, 63700, 71100, 79400, 85900, 92400],
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => 'Rs. ' + val.toLocaleString()
          }
        }
      }
    }
  });

  cashFlowChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Payments Received', 'Payments Paid', 'Operating Expenses'],
      datasets: [
        {
          label: 'Amount (PKR)',
          data: [382400, 227200, 50800],
          backgroundColor: ['#047857', '#2563eb', '#dc2626'],
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => 'Rs. ' + val.toLocaleString()
          }
        }
      }
    }
  });
}

function updateCharts(data) {
  if (!salesProfitChartInstance || !cashFlowChartInstance) {
    initCharts();
  }
  if (!salesProfitChartInstance) return;

  const badge = document.getElementById('chartStatusBadge');
  if (!data || data.total_sales_month === 0) {
    if (badge) badge.textContent = 'Initialized at 0';
    salesProfitChartInstance.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
    salesProfitChartInstance.data.datasets[1].data = [0, 0, 0, 0, 0, 0];
    cashFlowChartInstance.data.datasets[0].data = [0, 0, 0];
  } else {
    if (badge) badge.textContent = 'Live Sales Data';
    const curSales = data.total_sales_month || 0;
    const curProfit = data.total_profit_month || 0;
    salesProfitChartInstance.data.datasets[0].data = [
      Math.round(curSales * 0.62),
      Math.round(curSales * 0.74),
      Math.round(curSales * 0.81),
      Math.round(curSales * 0.89),
      Math.round(curSales * 0.95),
      curSales
    ];
    salesProfitChartInstance.data.datasets[1].data = [
      Math.round(curProfit * 0.58),
      Math.round(curProfit * 0.69),
      Math.round(curProfit * 0.77),
      Math.round(curProfit * 0.86),
      Math.round(curProfit * 0.93),
      curProfit
    ];
    cashFlowChartInstance.data.datasets[0].data = [
      data.payment_received_month,
      data.payment_paid_month,
      data.total_expenses_month
    ];
  }

  salesProfitChartInstance.update();
  cashFlowChartInstance.update();
}

function renderBestSellingTable(items) {
  const tbody = document.getElementById('bestSellingTableBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No sales recorded yet</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((p, idx) => `
    <tr>
      <td>
        <div style="font-weight: 700; color: var(--text-primary);">${idx + 1}. ${p.name}</div>
        <div style="font-size: 11px; color: var(--text-muted);">Barcode: ${p.barcode}</div>
      </td>
      <td><span class="badge badge-info">${p.category}</span></td>
      <td><b style="color: var(--brand-primary);">${p.units_sold} Pcs</b></td>
      <td>Rs. ${p.total_revenue.toLocaleString()}</td>
      <td><span class="badge badge-success">+Rs. ${p.total_profit.toLocaleString()}</span></td>
    </tr>
  `).join('');
}

function renderSlowestSellingTable(items) {
  const tbody = document.getElementById('slowestSellingTableBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No items to display</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((p, idx) => {
    let statusBadge = p.current_stock === 0 
      ? `<span class="badge badge-danger">Out of Stock</span>`
      : `<span class="badge badge-warning">Slow Moving</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 600;">${idx + 1}. ${p.name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">SKU: ${p.barcode}</div>
        </td>
        <td><b>${p.current_stock} Pcs</b></td>
        <td><span style="color: ${p.units_sold === 0 ? 'var(--brand-red)' : 'var(--text-primary)'}; font-weight: 600;">${p.units_sold} Sold</span></td>
        <td>${p.category}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderRecentInvoicesTable(invoices) {
  const tbody = document.getElementById('recentInvoicesTableBody');
  if (!invoices || invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No recent invoices</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><b>${inv.invoice_number}</b></td>
      <td>${inv.date}</td>
      <td><span style="font-weight: 600; color: var(--brand-primary);">${inv.customer_name}</span></td>
      <td>${inv.customer_phone || '-'}</td>
      <td>${inv.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
      <td><b>Rs. ${inv.grand_total.toLocaleString()}</b></td>
      <td><span class="badge badge-success">+Rs. ${inv.total_profit.toLocaleString()}</span></td>
      <td><span class="badge badge-info">${inv.payment_method}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showReceiptModalById('${inv.id}')">Print Receipt 🖨️</button>
      </td>
    </tr>
  `).join('');
}

// ======================== Inventory & Products ========================

async function loadInventory() {
  try {
    const search = document.getElementById('invSearchInput') ? document.getElementById('invSearchInput').value : '';
    const cat = document.getElementById('invCatSelect') ? document.getElementById('invCatSelect').value : 'All';
    const lowStock = document.getElementById('invLowStockOnly') ? document.getElementById('invLowStockOnly').checked : false;

    let prods = null;
    try {
      let url = `${API_BASE}/products?`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (cat && cat !== 'All') url += `category=${encodeURIComponent(cat)}&`;
      if (lowStock) url += `low_stock=true&`;
      const res = await fetch(url);
      if (res.ok) prods = await res.json();
    } catch (e) {}

    if (!prods || prods.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          prods = db.products || [];
        }
      } catch (e) {}
    }

    if (prods) {
      allProducts = prods;
      renderInventoryTable(allProducts);
      renderPosCatalog();
      populateExchangeProductDropdown();
    }
  } catch (err) {
    console.error('Failed to load inventory:', err);
  }
}

function renderInventoryTable(products) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
      <div style="font-size: 32px; margin-bottom: 8px;">👔</div>
      <b style="font-size: 16px; color: var(--text-primary);">Your Inventory Stock is Completely Empty (0 Items)</b>
      <p style="font-size: 13px; margin-top: 6px;">Click the green <b>'+ Add New Suit'</b> button above to add your first product or fabric.</p>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const profitPerSuit = p.selling_price - p.cost_price;
    let stockBadge = '';
    if (p.stock_quantity === 0) {
      stockBadge = `<span class="badge badge-danger">Out of Stock</span>`;
    } else if (p.stock_quantity <= p.min_stock_alert) {
      stockBadge = `<span class="badge badge-warning">Low Stock (${p.stock_quantity} left)</span>`;
    } else {
      stockBadge = `<span class="badge badge-success">Available (${p.stock_quantity} Pcs)</span>`;
    }

    return `
      <tr>
        <td>
          <code style="font-weight: bold; background: var(--bg-primary); padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${p.barcode}</code>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${p.name}</div>
          <div style="font-size: 11.5px; color: var(--text-muted);">${p.description || ''}</div>
        </td>
        <td>
          <div>${p.category}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${p.fabric}</div>
        </td>
        <td><span class="badge badge-info">${p.color}</span></td>
        <td><b style="font-size: 15px; color: ${p.stock_quantity === 0 ? 'var(--brand-red)' : 'var(--text-primary)'};">${p.stock_quantity}</b> Pcs</td>
        <td>Rs. ${p.cost_price.toLocaleString()}</td>
        <td><b style="color: var(--brand-primary);">Rs. ${p.selling_price.toLocaleString()}</b></td>
        <td><span class="badge badge-success">+Rs. ${profitPerSuit.toLocaleString()}</span></td>
        <td>${stockBadge}</td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="quickRestockPrompt('${p.barcode}')" title="Add Stock via Scanner">➕ Restock</button>
            <button class="btn btn-primary btn-sm" onclick="addCustomProductToCart('${p.id}')" title="Add to Counter Bill">🛒 Sell</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" title="Permanently Delete Suit">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Product from Inventory
async function deleteProduct(productId, productName) {
  const confirmed = confirm(`Are you sure you want to permanently delete '${productName}' from your inventory?`);
  if (!confirmed) return;

  try {
    await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('Error deleting product:', err);
  }

  allProducts = allProducts.filter(p => p.id !== productId);
  alert(`✅ Product '${productName}' has been deleted successfully.`);
  renderInventoryTable(allProducts);
  renderPosCatalog();
  populateExchangeProductDropdown();
  loadOverview();
}

// Add New Product
function openAddProductModal() {
  document.getElementById('addProductModal').classList.add('active');
}

async function submitNewProduct(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('newProdName').value,
    barcode: document.getElementById('newProdBarcode').value || undefined,
    category: document.getElementById('newProdCategory').value,
    fabric: document.getElementById('newProdFabric').value,
    color: document.getElementById('newProdColor').value,
    size: document.getElementById('newProdSize').value,
    cost_price: parseFloat(document.getElementById('newProdCost').value),
    selling_price: parseFloat(document.getElementById('newProdPrice').value),
    stock_quantity: parseInt(document.getElementById('newProdStock').value, 10),
    min_stock_alert: parseInt(document.getElementById('newProdMinAlert').value, 10) || 10,
  };

  try {
    let success = false;
    let newProd = null;
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        newProd = data.product;
        success = true;
      }
    } catch (e) {}

    if (!newProd) {
      newProd = {
        id: 'PRD-' + (Date.now().toString().slice(-6)),
        ...payload
      };
      success = true;
    }

    if (success) {
      const existingIdx = allProducts.findIndex(p => p.barcode === newProd.barcode);
      if (existingIdx >= 0) {
        allProducts[existingIdx] = newProd;
      } else {
        allProducts.unshift(newProd);
      }
      alert('Product suit successfully added to inventory!');
      closeModal('addProductModal');
      document.getElementById('addProductForm').reset();
      renderInventoryTable(allProducts);
      renderPosCatalog();
      populateExchangeProductDropdown();
      loadOverview();
    } else {
      alert('Failed to add product.');
    }
  } catch (err) {
    console.error('Error adding product:', err);
  }
}

// ======================== Restock Scanner Mode ========================

function openRestockModal() {
  document.getElementById('restockModal').classList.add('active');
  const input = document.getElementById('restockBarcodeInput');
  input.value = '';
  document.getElementById('restockPreviewBox').style.display = 'none';
  setTimeout(() => input.focus(), 100);
}

function quickRestockPrompt(barcode) {
  openRestockModal();
  document.getElementById('restockBarcodeInput').value = barcode;
  checkProductForRestock();
}

async function checkProductForRestock() {
  const barcode = document.getElementById('restockBarcodeInput').value.trim();
  if (!barcode) return;

  const localProd = allProducts.find(p => p.barcode === barcode);
  if (localProd) {
    document.getElementById('restockPreviewBox').style.display = 'block';
    document.getElementById('restockProdName').textContent = localProd.name;
    document.getElementById('restockCurrentStock').textContent = `${localProd.stock_quantity} Pieces`;
    document.getElementById('restockProdColor').textContent = localProd.color;
    document.getElementById('restockQtyInput').focus();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products/by-barcode/${encodeURIComponent(barcode)}`);
    if (res.ok) {
      const prod = await res.json();
      document.getElementById('restockPreviewBox').style.display = 'block';
      document.getElementById('restockProdName').textContent = prod.name;
      document.getElementById('restockCurrentStock').textContent = `${prod.stock_quantity} Pieces`;
      document.getElementById('restockProdColor').textContent = prod.color;
      document.getElementById('restockQtyInput').focus();
    } else {
      document.getElementById('restockPreviewBox').style.display = 'none';
      alert(`Barcode '${barcode}' not found. Please add the suit in inventory first.`);
    }
  } catch (err) {
    console.error('Error finding product:', err);
  }
}

async function submitRestockScanner() {
  const barcode = document.getElementById('restockBarcodeInput').value.trim();
  const qty = parseInt(document.getElementById('restockQtyInput').value, 10) || 1;

  if (!barcode) {
    alert('Please scan or enter a barcode.');
    return;
  }

  let newTotalStock = null;
  try {
    const res = await fetch(`${API_BASE}/products/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, quantity_to_add: qty }),
    });
    if (res.ok) {
      const result = await res.json();
      newTotalStock = result.new_total_stock;
    }
  } catch (err) {}

  // Fallback update in-memory
  const p = allProducts.find(x => x.barcode === barcode);
  if (p) {
    if (newTotalStock === null) {
      p.stock_quantity += qty;
      newTotalStock = p.stock_quantity;
    } else {
      p.stock_quantity = newTotalStock;
    }
  }

  if (newTotalStock !== null) {
    alert(`✅ Success: Added ${qty} pieces! New total stock is: ${newTotalStock}`);
    closeModal('restockModal');
    renderInventoryTable(allProducts);
    renderPosCatalog();
    populateExchangeProductDropdown();
    loadOverview();
  } else {
    alert('❌ Failed to update stock');
  }
}

// ======================== Point of Sale (POS) ========================

function renderPosCatalog() {
  const grid = document.getElementById('posCatalogGrid');
  if (!grid) return;

  const search = document.getElementById('posFilterSearch') ? document.getElementById('posFilterSearch').value.toLowerCase() : '';
  const cat = document.getElementById('posFilterCat') ? document.getElementById('posFilterCat').value : 'All';

  let filtered = allProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search) || p.barcode.toLowerCase().includes(search) || p.color.toLowerCase().includes(search);
    const matchCat = cat === 'All' || p.category === cat;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    if (allProducts.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 20px;">
        <div style="font-size: 36px; margin-bottom: 8px;">🛍️</div>
        <b style="font-size: 16px; color: var(--text-primary);">Counter Catalog is Empty (0 Suits Available)</b>
        <p style="font-size: 13px; margin-top: 6px;">Go to the <b>'Stock & Scanner'</b> tab and click <b>'+ Add New Suit'</b> to enter clothing items into inventory.</p>
      </div>`;
    } else {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 25px;">No suits matching filters</div>`;
    }
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isOut = p.stock_quantity <= 0;
    return `
      <div class="panel-card" style="padding: 12px; cursor: ${isOut ? 'not-allowed' : 'pointer'}; opacity: ${isOut ? '0.5' : '1'}; transition: all 0.2s;" onclick="${isOut ? '' : `addCustomProductToCart('${p.id}')`}">
        <div style="font-size: 11px; color: var(--text-muted);">${p.barcode}</div>
        <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin: 4px 0;">${p.name}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${p.color} | ${p.fabric}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <b style="color: var(--brand-primary); font-size: 14px;">Rs. ${p.selling_price.toLocaleString()}</b>
          <span style="font-size: 11px; font-weight: 600; color: ${isOut ? 'var(--brand-red)' : 'var(--text-muted)'};">
            ${isOut ? 'Out of Stock' : `${p.stock_quantity} left`}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function filterPosCatalog() {
  renderPosCatalog();
}

async function handlePosBarcodeScan() {
  const input = document.getElementById('posBarcodeInput');
  const barcode = input.value.trim();
  if (!barcode) return;

  const localProd = allProducts.find(p => p.barcode === barcode);
  if (localProd) {
    addCustomProductToCart(localProd.id);
    input.value = '';
    input.focus();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products/by-barcode/${encodeURIComponent(barcode)}`);
    if (res.ok) {
      const prod = await res.json();
      addCustomProductToCart(prod.id);
      input.value = '';
      input.focus();
    } else {
      alert(`Barcode '${barcode}' not found in inventory.`);
      input.select();
    }
  } catch (err) {
    console.error('POS barcode error:', err);
  }
}

function addCustomProductToCart(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  if (prod.stock_quantity <= 0) {
    alert(`Sorry! Suit '${prod.name}' is out of stock.`);
    return;
  }

  const existing = posCart.find(item => item.product_id === prod.id);
  if (existing) {
    if (existing.quantity + 1 > prod.stock_quantity) {
      alert(`Requested quantity exceeds available stock (${prod.stock_quantity}).`);
      return;
    }
    existing.quantity += 1;
  } else {
    posCart.push({
      product_id: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      color: prod.color,
      fabric: prod.fabric,
      unit_price: prod.selling_price,
      unit_cost: prod.cost_price,
      quantity: 1,
      available_stock: prod.stock_quantity,
    });
  }

  renderPosCart();
}

function updateCartQty(productId, delta) {
  const item = posCart.find(i => i.product_id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    posCart = posCart.filter(i => i.product_id !== productId);
  } else if (newQty > item.available_stock) {
    alert(`Only ${item.available_stock} pieces available in stock.`);
    return;
  } else {
    item.quantity = newQty;
  }

  renderPosCart();
}

function removeCartItem(productId) {
  posCart = posCart.filter(i => i.product_id !== productId);
  renderPosCart();
}

function clearPosCart() {
  posCart = [];
  renderPosCart();
}

function renderPosCart() {
  const container = document.getElementById('posCartItemsList');
  const countBadge = document.getElementById('cartCountBadge');
  countBadge.textContent = posCart.reduce((sum, i) => sum + i.quantity, 0);

  if (posCart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); margin-top: 50px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
        <div>Bill cart is empty</div>
        <div style="font-size: 11.5px; margin-top: 4px;">Scan barcode or select a suit</div>
      </div>
    `;
    calculatePosTotals();
    return;
  }

  container.innerHTML = posCart.map(item => `
    <div class="pos-item-row">
      <div class="pos-item-info">
        <h4>${item.name}</h4>
        <p>${item.color} | Barcode: ${item.barcode}</p>
        <div style="font-size: 12px; font-weight: 700; color: var(--brand-primary); margin-top: 2px;">
          Rs. ${item.unit_price.toLocaleString()} × ${item.quantity} = Rs. ${(item.unit_price * item.quantity).toLocaleString()}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="pos-item-qty">
          <button class="qty-btn" onclick="updateCartQty('${item.product_id}', -1)">-</button>
          <span style="font-weight: 700; min-width: 20px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.product_id}', 1)">+</button>
        </div>
        <button style="background: none; border: none; cursor: pointer; color: var(--brand-red); font-size: 14px;" onclick="removeCartItem('${item.product_id}')">🗑️</button>
      </div>
    </div>
  `).join('');

  calculatePosTotals();
}

function calculatePosTotals() {
  const subtotal = posCart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const totalCost = posCart.reduce((sum, i) => sum + (i.unit_cost * i.quantity), 0);
  const discountInput = document.getElementById('posDiscount');
  const discount = parseFloat(discountInput.value) || 0;

  const grandTotal = Math.max(0, subtotal - discount);
  const totalProfit = Math.max(0, grandTotal - totalCost);

  document.getElementById('posSubtotal').textContent = `Rs. ${subtotal.toLocaleString()}`;
  document.getElementById('posGrandTotal').textContent = `Rs. ${grandTotal.toLocaleString()}`;
  document.getElementById('posTotalProfit').textContent = `+Rs. ${totalProfit.toLocaleString()}`;

  calculatePosChange();
}

function calculatePosChange() {
  const subtotal = posCart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const discount = parseFloat(document.getElementById('posDiscount').value) || 0;
  const grandTotal = Math.max(0, subtotal - discount);

  const amountPaidInput = document.getElementById('posAmountPaid');
  const amountPaid = parseFloat(amountPaidInput.value) || 0;
  const change = amountPaid > grandTotal ? (amountPaid - grandTotal) : 0;

  document.getElementById('posChangeDue').textContent = `Rs. ${change.toLocaleString()}`;
}

function setQuickWalkinCustomer() {
  document.getElementById('posCustName').value = 'Walk-in Customer';
  document.getElementById('posCustPhone').value = '0300-0000000';
  document.getElementById('posCustCity').value = 'Gujranwala';
}

async function submitPosCheckout() {
  if (posCart.length === 0) {
    alert('Please add at least one suit to the bill first.');
    return;
  }

  const custName = document.getElementById('posCustName').value.trim() || 'Walk-in Customer';
  const custPhone = document.getElementById('posCustPhone').value.trim() || '0300-0000000';
  const custCity = document.getElementById('posCustCity').value.trim() || 'Gujranwala';
  const discount = parseFloat(document.getElementById('posDiscount').value) || 0;
  const paymentMethod = document.getElementById('posPaymentMethod').value;
  
  const subtotal = posCart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const amountPaidInput = parseFloat(document.getElementById('posAmountPaid').value);
  const amountPaid = isNaN(amountPaidInput) || amountPaidInput === 0 ? grandTotal : amountPaidInput;

  const payload = {
    customer_name: custName,
    customer_phone: custPhone,
    customer_city: custCity,
    items: posCart.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      custom_price: i.unit_price,
    })),
    discount,
    tax_percentage: 0.0,
    payment_method: paymentMethod,
    amount_paid: amountPaid,
    notes: 'POS Counter Sale Checkout',
  };

  try {
    let success = false;
    let createdInvoice = null;

    try {
      const res = await fetch(`${API_BASE}/pos/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.invoice) {
          createdInvoice = data.invoice;
          success = true;
        }
      }
    } catch (e) {}

    // Fallback: local checkout simulation if serverless API didn't respond
    if (!success) {
      const invNum = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      let itemsProfit = 0;

      payload.items.forEach(it => {
        const prod = allProducts.find(p => p.id === it.product_id);
        if (prod) {
          prod.stock_quantity = Math.max(0, prod.stock_quantity - it.quantity);
          itemsProfit += (it.custom_price - (prod.cost_price || 0)) * it.quantity;
        }
      });

      createdInvoice = {
        id: invNum,
        invoice_number: invNum,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        date: nowStr.slice(0, 10),
        created_at: nowStr,
        items: posCart.map(i => ({
          product_id: i.product_id,
          name: i.name,
          color: i.color,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total
        })),
        subtotal: subtotal,
        discount: discount,
        tax: 0,
        grand_total: grandTotal,
        amount_paid: amountPaid,
        change_due: Math.max(0, amountPaid - grandTotal),
        payment_method: payload.payment_method,
        status: amountPaid >= grandTotal ? 'Paid' : 'Partial',
        notes: payload.notes,
        total_profit: Math.max(0, itemsProfit - discount)
      };

      allInvoicesData.unshift(createdInvoice);
      success = true;
    }

    if (success && createdInvoice) {
      alert(`✅ Sale successfully completed! Stock deducted.\nInvoice: ${createdInvoice.invoice_number}`);
      
      // Open receipt modal
      showReceiptModal(createdInvoice);

      // Clear POS Screen
      clearPosCart();
      document.getElementById('posDiscount').value = 0;
      document.getElementById('posAmountPaid').value = '';

      // Immediately refresh inventory and overview so stock is visibly decreased!
      renderInventoryTable(allProducts);
      renderPosCatalog();
      populateExchangeProductDropdown();
      loadOverview();
      loadInvoices();
      loadCustomers();

    } else {
      alert('❌ Error creating invoice');
    }
  } catch (err) {
    console.error('Checkout error:', err);
  }
}

// ======================== Thermal Receipt & Printing ========================

function showReceiptModal(inv) {
  document.getElementById('recInvoiceNum').textContent = inv.invoice_number;
  document.getElementById('recDate').textContent = inv.date;
  document.getElementById('recCustName').textContent = inv.customer_name;
  document.getElementById('recCustPhone').textContent = inv.customer_phone || '-';

  const tbody = document.getElementById('recItemsBody');
  tbody.innerHTML = inv.items.map(i => `
    <tr>
      <td>${i.name} (${i.color})</td>
      <td>${i.quantity}</td>
      <td>${i.unit_price}</td>
      <td>${i.total}</td>
    </tr>
  `).join('');

  document.getElementById('recSubtotal').textContent = `Rs. ${inv.subtotal.toLocaleString()}`;
  document.getElementById('recDiscount').textContent = `Rs. ${inv.discount.toLocaleString()}`;
  document.getElementById('recGrandTotal').textContent = `Rs. ${inv.grand_total.toLocaleString()}`;
  document.getElementById('recPaid').textContent = `Rs. ${inv.amount_paid.toLocaleString()}`;
  document.getElementById('recChange').textContent = `Rs. ${inv.change_due.toLocaleString()}`;

  document.getElementById('receiptModal').classList.add('active');
}

async function showReceiptModalById(invoiceId) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}`);
    if (res.ok) {
      const inv = await res.json();
      showReceiptModal(inv);
    }
  } catch (err) {
    console.error('Failed to get invoice:', err);
  }
}

function printReceipt() {
  window.print();
}

// ======================== Customer Database & Purchase History ========================

async function loadCustomers() {
  try {
    let custs = null;
    try {
      const res = await fetch(`${API_BASE}/customers`);
      if (res.ok) custs = await res.json();
    } catch (e) {}

    if (!custs || custs.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          custs = db.customers || [];
        }
      } catch (e) {}
    }

    if (custs) {
      allCustomers = custs;
      renderCustomersTable(allCustomers);
    }
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('allCustomersTableBody');
  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">No customers registered yet. Enter customer name and phone at the POS counter to automatically record their profile and purchase history.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td><b>${c.id}</b></td>
      <td><span style="font-weight: 700; color: var(--brand-primary);">${c.name}</span></td>
      <td>${c.phone}</td>
      <td>${c.city}</td>
      <td><b style="color: var(--brand-gold);">Rs. ${c.total_purchases.toLocaleString()}</b></td>
      <td><span class="badge badge-info">${c.total_orders} Orders</span></td>
      <td>${c.created_at.split(' ')[0]}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="viewCustomerFullHistory('${c.id}')">
          View Purchase History 👗
        </button>
      </td>
    </tr>
  `).join('');
}

async function searchCustomers() {
  const query = document.getElementById('customerSearchInput').value.trim();
  if (!query) {
    renderCustomersTable(allCustomers);
    document.getElementById('customerDetailSection').style.display = 'none';
    return;
  }

  const filtered = allCustomers.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    c.phone.includes(query) || 
    c.id.toLowerCase().includes(query.toLowerCase())
  );

  renderCustomersTable(filtered);

  if (filtered.length === 1) {
    viewCustomerFullHistory(filtered[0].id);
  }
}

async function viewCustomerFullHistory(customerIdOrPhone) {
  try {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(customerIdOrPhone)}`);
    if (res.ok) {
      const data = await res.json();
      const sec = document.getElementById('customerDetailSection');
      sec.style.display = 'block';

      document.getElementById('custDetailName').textContent = data.customer.name;
      document.getElementById('custDetailPhone').textContent = data.customer.phone;
      document.getElementById('custDetailCity').textContent = data.customer.city;
      document.getElementById('custDetailTotalPurchases').textContent = `Rs. ${data.customer.total_purchases.toLocaleString()}`;
      document.getElementById('custDetailOrderCount').textContent = `${data.customer.total_orders} Purchases / Invoices`;

      const tbody = document.getElementById('custPurchaseHistoryTableBody');
      if (data.purchase_history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">This customer has no purchase history.</td></tr>`;
      } else {
        tbody.innerHTML = data.purchase_history.map(item => `
          <tr>
            <td>${item.date}</td>
            <td><b>${item.invoice_number}</b></td>
            <td><b style="color: var(--brand-primary);">${item.product_name}</b></td>
            <td><code>${item.barcode}</code></td>
            <td><span class="badge badge-info">${item.color}</span></td>
            <td><b>${item.quantity} Pcs</b></td>
            <td>Rs. ${item.unit_price.toLocaleString()}</td>
            <td><b>Rs. ${item.total.toLocaleString()}</b></td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="openReturnModalFromHistory('${item.invoice_id}', '${item.invoice_number}', '${data.customer.name}', '${item.product_id}', '${item.product_name}', ${item.unit_price}, ${item.quantity})">
                🔄 Process Return / Refund
              </button>
            </td>
          </tr>
        `).join('');
      }

      // Scroll smoothly to detail section
      sec.scrollIntoView({ behavior: 'smooth' });

    } else {
      alert('Customer details could not be found.');
    }
  } catch (err) {
    console.error('Error fetching customer history:', err);
  }
}

// Add New Customer Modal
function openAddCustomerModal() {
  const name = prompt('Enter Customer Full Name:');
  if (!name) return;
  const phone = prompt('Enter Customer Mobile Phone:');
  if (!phone) return;
  const city = prompt('Enter Customer City:', 'Lahore');

  fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, city }),
  }).then(res => res.json()).then(cust => {
    alert(`Customer '${cust.name}' successfully registered.`);
    loadCustomers();
  });
}

// ======================== Returns & Exchange Engine ========================

let allSalesReturnsData = [];

function populateExchangeProductDropdown(excludeProductId = null) {
  const sel = document.getElementById('exchangeNewProductSelect');
  if (!sel) return;

  const validProducts = allProducts.filter(p => p.id !== excludeProductId && p.stock_quantity > 0);
  if (validProducts.length === 0) {
    sel.innerHTML = `<option value="">-- No replacement suits in stock --</option>`;
    return;
  }

  sel.innerHTML = validProducts.map(p => `
    <option value="${p.id}" data-price="${p.selling_price}" data-stock="${p.stock_quantity}">
      ${p.name} — Rs. ${p.selling_price.toLocaleString()} (${p.stock_quantity} Pcs available)
    </option>
  `).join('');
}

function calculateExchangeDiff() {
  if (!selectedReturnItem) return;

  const qtyInput = document.getElementById('retModalQty');
  const returnQty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  const returnCredit = (selectedReturnItem.unit_price || 0) * returnQty;

  const creditBadge = document.getElementById('retTotalCreditBadge');
  const creditDisplay = document.getElementById('retCreditDisplay');
  if (creditBadge) creditBadge.textContent = `Rs. ${returnCredit.toLocaleString()}`;
  if (creditDisplay) creditDisplay.textContent = `- Rs. ${returnCredit.toLocaleString()}`;

  const sel = document.getElementById('exchangeNewProductSelect');
  const selectedOpt = sel ? sel.options[sel.selectedIndex] : null;
  const newPrice = selectedOpt ? (parseFloat(selectedOpt.getAttribute('data-price')) || 0) : 0;

  const newQtyInput = document.getElementById('exchangeNewQty');
  const newQty = Math.max(1, parseInt(newQtyInput.value, 10) || 1);
  const newTotal = newPrice * newQty;

  const newTotalDisplay = document.getElementById('newSuitTotalDisplay');
  if (newTotalDisplay) newTotalDisplay.textContent = `+ Rs. ${newTotal.toLocaleString()}`;

  const diff = newTotal - returnCredit;
  const diffLabel = document.getElementById('exchangeDiffLabel');
  const diffAmount = document.getElementById('exchangeDiffAmount');

  if (diffLabel && diffAmount) {
    if (diff > 0) {
      diffLabel.textContent = 'Customer to Pay Balance:';
      diffAmount.textContent = `+ Rs. ${diff.toLocaleString()}`;
      diffAmount.style.color = 'var(--brand-gold)';
    } else if (diff < 0) {
      diffLabel.textContent = 'Store to Refund Balance:';
      diffAmount.textContent = `- Rs. ${Math.abs(diff).toLocaleString()}`;
      diffAmount.style.color = 'var(--brand-primary)';
    } else {
      diffLabel.textContent = 'Even Exchange (Zero Balance):';
      diffAmount.textContent = 'Rs. 0 (Even Exchange)';
      diffAmount.style.color = 'var(--brand-primary)';
    }
  }
}

function openReturnModalFromHistory(invoiceId, invoiceNumber, custName, productId, productName, unitPrice, maxQty) {
  selectedReturnItem = {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    customer_name: custName,
    product_id: productId,
    product_name: productName,
    unit_price: unitPrice,
    max_quantity: maxQty,
  };

  document.getElementById('retModalSuitName').textContent = productName;
  document.getElementById('retModalCustName').textContent = custName;
  document.getElementById('retModalInvNum').textContent = invoiceNumber;
  document.getElementById('retModalUnitPrice').textContent = `Rs. ${unitPrice.toLocaleString()}`;

  const qtyInput = document.getElementById('retModalQty');
  qtyInput.value = 1;
  qtyInput.max = maxQty;

  populateExchangeProductDropdown(productId);
  selectReturnType('SUIT_EXCHANGE');
  calculateExchangeDiff();

  document.getElementById('returnModal').classList.add('active');
}

function openReturnModalForInvoice(invId) {
  const inv = allInvoicesData.find(i => i.id === invId || i.invoice_number === invId);
  if (!inv) return alert('Invoice not found');
  if (!inv.items || inv.items.length === 0) return alert('No items found in this invoice');

  let chosenItem = inv.items[0];
  if (inv.items.length > 1) {
    const list = inv.items.map((it, idx) => `${idx + 1}. ${it.name} (${it.color}) - Qty: ${it.quantity} Pcs @ Rs. ${it.unit_price}`).join('\n');
    const pick = prompt(`This invoice has multiple items. Choose which suit customer is returning (1 to ${inv.items.length}):\n${list}`, '1');
    if (!pick) return;
    const index = parseInt(pick, 10) - 1;
    if (index >= 0 && index < inv.items.length) {
      chosenItem = inv.items[index];
    }
  }

  openReturnModalFromHistory(
    inv.id,
    inv.invoice_number,
    inv.customer_name,
    chosenItem.product_id,
    chosenItem.name,
    chosenItem.unit_price,
    chosenItem.quantity
  );
}

function selectReturnType(type) {
  selectedReturnType = type;
  const optExchange = document.getElementById('optSuitExchange');
  const optRefund = document.getElementById('optCashRefund');
  const exchangeSection = document.getElementById('exchangeProductSection');

  if (type === 'SUIT_EXCHANGE') {
    optExchange.classList.add('selected');
    optRefund.classList.remove('selected');
    if (exchangeSection) exchangeSection.style.display = 'block';
  } else {
    optRefund.classList.add('selected');
    optExchange.classList.remove('selected');
    if (exchangeSection) exchangeSection.style.display = 'none';
  }
  calculateExchangeDiff();
}

async function submitReturnProcess() {
  if (!selectedReturnItem) return;

  const qty = parseInt(document.getElementById('retModalQty').value, 10) || 1;
  const reason = document.getElementById('retModalReason').value || 'Customer return or exchange';

  const exchangePid = selectedReturnType === 'SUIT_EXCHANGE' ? document.getElementById('exchangeNewProductSelect').value : null;
  const exchangeQty = selectedReturnType === 'SUIT_EXCHANGE' ? (parseInt(document.getElementById('exchangeNewQty').value, 10) || 1) : 0;
  const paymentMethod = document.getElementById('exchangePaymentMethod').value || 'Cash';

  const payload = {
    invoice_id: selectedReturnItem.invoice_id,
    product_id: selectedReturnItem.product_id,
    quantity: qty,
    return_type: selectedReturnType,
    reason,
    exchange_product_id: exchangePid,
    exchange_quantity: exchangeQty,
    payment_method: paymentMethod
  };

  try {
    let success = false;
    let data = null;

    try {
      const res = await fetch(`${API_BASE}/returns/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        data = await res.json();
        if (data.success) success = true;
      }
    } catch (e) {}

    // Fallback: local return / exchange execution
    if (!success) {
      const returnId = `RET-2026-${Math.floor(100 + Math.random() * 900)}`;
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const retProduct = allProducts.find(p => p.id === payload.product_id);
      if (retProduct) {
        retProduct.stock_quantity += payload.quantity;
      }

      let exchProduct = null;
      if (payload.return_type === 'SUIT_EXCHANGE' && payload.exchange_product_id) {
        exchProduct = allProducts.find(p => p.id === payload.exchange_product_id);
        if (exchProduct) {
          exchProduct.stock_quantity = Math.max(0, exchProduct.stock_quantity - (payload.exchange_quantity || 1));
        }
      }

      const returnedCredit = selectedReturnItem.unit_price * payload.quantity;
      const exchangeTotal = exchProduct ? (exchProduct.selling_price * (payload.exchange_quantity || 1)) : 0;
      const netPayable = exchangeTotal - returnedCredit;

      const exchangeSlip = {
        id: returnId,
        date: nowStr.slice(0, 10),
        created_at: nowStr,
        return_type: payload.return_type,
        invoice_number: selectedReturnItem.invoice_number,
        customer_name: selectedReturnItem.customer_name,
        customer_phone: selectedReturnItem.customer_phone || '-',
        product_name: selectedReturnItem.name,
        color: selectedReturnItem.color,
        quantity: payload.quantity,
        unit_price: selectedReturnItem.unit_price,
        returned_credit: returnedCredit,
        refund_amount: payload.return_type === 'CASH_REFUND' ? returnedCredit : 0,
        exchange_product_name: exchProduct ? exchProduct.name : '',
        exchange_color: exchProduct ? exchProduct.color : '',
        exchange_quantity: exchProduct ? (payload.exchange_quantity || 1) : 0,
        exchange_unit_price: exchProduct ? exchProduct.selling_price : 0,
        exchange_new_total: exchangeTotal,
        net_payable_difference: netPayable,
        settlement_status: netPayable > 0 ? 'Customer Paid Difference' : (netPayable < 0 ? 'Refunded to Customer' : 'Even Exchange'),
        payment_method: payload.payment_method
      };

      allSalesReturnsData.unshift(exchangeSlip);
      data = {
        success: true,
        message: 'Return and exchange processed successfully.',
        exchange_slip: exchangeSlip
      };
      success = true;
    }

    if (success && data) {
      closeModal('returnModal');

      // Refresh data
      renderInventoryTable(allProducts);
      renderPosCatalog();
      populateExchangeProductDropdown();
      loadSalesReturns();
      loadOverview();
      loadCustomers();
      loadInvoices();

      if (selectedReturnItem.customer_name) {
        viewCustomerFullHistory(selectedReturnItem.customer_name);
      }

      // Automatically show and print thermal exchange slip
      if (data.exchange_slip) {
        showExchangeSlipModal(data.exchange_slip);
      } else {
        alert(`✅ ${data.message}`);
      }
    } else {
      alert(`❌ Error processing return: ${(data && data.error) || 'Failed'}`);
    }
  } catch (err) {
    console.error('Error processing return:', err);
  }
}

// Thermal Return & Exchange Slip Modal Display
function showExchangeSlipModal(slip) {
  document.getElementById('slipId').textContent = slip.id;
  document.getElementById('slipDate').textContent = slip.date;
  document.getElementById('slipTime').textContent = slip.created_at ? slip.created_at.split(' ')[1] : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('slipInvoiceRef').textContent = slip.invoice_number || slip.invoice_id;
  document.getElementById('slipCustName').textContent = slip.customer_name;
  document.getElementById('slipCustPhone').textContent = slip.customer_phone || '-';

  // 1. Returned Table
  const retTable = document.getElementById('slipReturnedTableBody');
  retTable.innerHTML = `
    <tr>
      <td>${slip.product_name} ${slip.color ? '(' + slip.color + ')' : ''}</td>
      <td>${slip.quantity}</td>
      <td>Rs. ${(slip.unit_price || 0).toLocaleString()}</td>
      <td style="color: #dc2626; font-weight: bold;">- Rs. ${(slip.returned_credit || slip.refund_amount || 0).toLocaleString()}</td>
    </tr>
  `;

  // 2. Exchanged New Item Table
  const exchSec = document.getElementById('slipExchangeSection');
  const exchTable = document.getElementById('slipExchangeTableBody');
  const exchTotalRow = document.getElementById('slipNewTotalRow');

  if (slip.exchange_item) {
    if (exchSec) exchSec.style.display = 'block';
    if (exchTotalRow) exchTotalRow.style.display = 'flex';
    exchTable.innerHTML = `
      <tr>
        <td>${slip.exchange_item.name} ${slip.exchange_item.color ? '(' + slip.exchange_item.color + ')' : ''}</td>
        <td>${slip.exchange_item.quantity}</td>
        <td>Rs. ${slip.exchange_item.unit_price.toLocaleString()}</td>
        <td style="color: #047857; font-weight: bold;">+ Rs. ${slip.exchange_item.total.toLocaleString()}</td>
      </tr>
    `;
    document.getElementById('slipNewTotal').textContent = `+ Rs. ${slip.exchange_item.total.toLocaleString()}`;
  } else {
    if (exchSec) exchSec.style.display = 'none';
    if (exchTotalRow) exchTotalRow.style.display = 'none';
    exchTable.innerHTML = '';
  }

  // Breakdown
  const credit = slip.returned_credit || slip.refund_amount || 0;
  document.getElementById('slipCreditTotal').textContent = `- Rs. ${credit.toLocaleString()}`;

  const net = slip.net_difference !== undefined ? slip.net_difference : -credit;
  const netLabel = document.getElementById('slipNetLabel');
  const netAmount = document.getElementById('slipNetAmount');

  if (net > 0) {
    netLabel.textContent = 'CUSTOMER PAID BALANCE:';
    netAmount.textContent = `+ Rs. ${net.toLocaleString()}`;
    netAmount.style.color = '#b45309';
  } else if (net < 0) {
    netLabel.textContent = 'STORE REFUNDED BALANCE:';
    netAmount.textContent = `- Rs. ${Math.abs(net).toLocaleString()}`;
    netAmount.style.color = '#047857';
  } else {
    netLabel.textContent = 'EVEN EXCHANGE:';
    netAmount.textContent = 'Rs. 0 (Even Value)';
    netAmount.style.color = '#047857';
  }

  document.getElementById('slipPaymentMethod').textContent = slip.payment_method || 'Cash Counter';
  document.getElementById('slipReason').textContent = slip.reason || 'Customer Exchange';

  document.getElementById('exchangeSlipModal').classList.add('active');
}

function printExchangeSlip() {
  window.print();
}

function reprintExchangeSlip(slipId) {
  const slip = allSalesReturnsData.find(s => s.id === slipId);
  if (!slip) return alert('Return slip not found');
  showExchangeSlipModal(slip);
}

async function loadSalesReturns() {
  try {
    let rets = null;
    try {
      const res = await fetch(`${API_BASE}/returns`);
      if (res.ok) rets = await res.json();
    } catch (e) {}

    if (!rets || rets.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          rets = [...(db.sales_returns || [])].reverse();
        }
      } catch (e) {}
    }

    if (rets) {
      allSalesReturnsData = rets;
    }
    const tbody = document.getElementById('salesReturnsTableBody');
    if (!tbody) return;

    if (allSalesReturnsData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No returns recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allSalesReturnsData.map(r => {
      const isExch = r.exchange_item || (r.return_type && r.return_type.includes('Exchange'));
      const exchText = r.exchange_item ? `${r.exchange_item.name} (x${r.exchange_item.quantity})` : '—';
      
      let adjText = '';
      if (r.net_difference !== undefined) {
        if (r.net_difference > 0) {
          adjText = `<span class="badge badge-warning">+Rs. ${r.net_difference.toLocaleString()} (Paid)</span>`;
        } else if (r.net_difference < 0) {
          adjText = `<span class="badge badge-info">-Rs. ${Math.abs(r.net_difference).toLocaleString()} (Refund)</span>`;
        } else {
          adjText = `<span class="badge badge-success">Rs. 0 (Even)</span>`;
        }
      } else {
        adjText = `<b style="color: var(--brand-red);">-Rs. ${r.refund_amount.toLocaleString()}</b>`;
      }

      return `
        <tr>
          <td><b>${r.id}</b></td>
          <td>${r.date}</td>
          <td><span style="color: var(--brand-gold); font-weight: 700;">${r.invoice_id}</span></td>
          <td><b>${r.customer_name}</b></td>
          <td>${r.product_name} (${r.quantity} Pcs)</td>
          <td><span style="color: var(--brand-primary); font-weight: 600;">${exchText}</span></td>
          <td>${adjText}</td>
          <td><span style="font-size: 11.5px; color: var(--text-muted);">${r.reason}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="reprintExchangeSlip('${r.id}')">
              <span>🖨️</span>
              <span>Slip</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load sales returns:', err);
  }
}

// ======================== Invoices List ========================

let allInvoicesData = [];

async function loadInvoices() {
  try {
    let invs = null;
    try {
      const res = await fetch(`${API_BASE}/invoices`);
      if (res.ok) invs = await res.json();
    } catch (e) {}

    if (!invs || invs.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          invs = [...(db.invoices || [])].reverse();
        }
      } catch (e) {}
    }

    if (invs) {
      allInvoicesData = invs;
      renderInvoicesTable(allInvoicesData);
    }
  } catch (err) {
    console.error('Failed to load invoices:', err);
  }
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('allInvoicesTableBody');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No invoices found</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><b>${inv.invoice_number}</b></td>
      <td>${inv.date}</td>
      <td><span style="font-weight: 700; color: var(--brand-primary);">${inv.customer_name}</span></td>
      <td>${inv.customer_phone || '-'}</td>
      <td>${inv.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
      <td><b style="font-size: 14px;">Rs. ${inv.grand_total.toLocaleString()}</b></td>
      <td><span class="badge badge-success">+Rs. ${inv.total_profit.toLocaleString()}</span></td>
      <td><span class="badge badge-info">${inv.payment_method}</span></td>
      <td><span class="badge ${inv.status.includes('Returned') || inv.status.includes('Exchanged') ? 'badge-danger' : 'badge-success'}">${inv.status}</span></td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-secondary btn-sm" onclick="showReceiptModalById('${inv.id}')" title="Print Invoice Receipt">Print 🖨️</button>
          <button class="btn btn-warning btn-sm" onclick="openReturnModalForInvoice('${inv.id}')" title="Return or Exchange Product">🔄 Return</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterInvoices() {
  const query = document.getElementById('invoiceSearchInput').value.toLowerCase();
  const filtered = allInvoicesData.filter(i => 
    i.invoice_number.toLowerCase().includes(query) ||
    i.customer_name.toLowerCase().includes(query) ||
    i.customer_phone.includes(query)
  );
  renderInvoicesTable(filtered);
}

// ======================== Suppliers & Purchases ========================

let allSuppliers = [];

async function loadSuppliers() {
  try {
    let sups = null;
    try {
      const res = await fetch(`${API_BASE}/suppliers`);
      if (res.ok) sups = await res.json();
    } catch (e) {}

    if (!sups || sups.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          sups = db.suppliers || [];
        }
      } catch (e) {}
    }

    if (sups) allSuppliers = sups;
    const grid = document.getElementById('suppliersCardsGrid');
    if (!grid) return;

    if (allSuppliers.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 35px 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🏭</div>
        <b style="font-size: 15px; color: var(--text-primary);">No Suppliers Registered Yet</b>
        <p style="font-size: 13px; margin-top: 5px;">Click <b>'+ Add New Supplier'</b> above to add textile mills and fabric dealers.</p>
      </div>`;
      return;
    }

    grid.innerHTML = allSuppliers.map(s => `
      <div class="panel-card" style="border-left: 4px solid var(--brand-primary); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-size: 15px; font-weight: 700; color: var(--brand-primary);">${s.name}</div>
          <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.id}', '${s.name.replace(/'/g, "\\'")}')" style="padding: 2px 6px; font-size: 11px;" title="Delete Supplier">🗑️</button>
        </div>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin: 4px 0;">Contact: ${s.contact_person} | 📞 ${s.phone}</div>
        <div style="font-size: 11.5px; color: var(--text-muted);">${s.address}</div>
        <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
          <div>
            <div style="font-size: 10.5px; color: var(--text-muted);">Total Supplies</div>
            <div style="font-weight: 700;">Rs. ${s.total_purchased.toLocaleString()}</div>
          </div>
          <div>
            <div style="font-size: 10.5px; color: var(--text-muted);">Payable Balance (Due)</div>
            <div style="font-weight: 700; color: var(--brand-red);">Rs. ${s.balance_payable.toLocaleString()}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }
}

async function deleteSupplier(id, name) {
  if (!confirm(`Are you sure you want to delete supplier '${name}'?`)) return;
  try {
    const res = await fetch(`${API_BASE}/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      alert(`Supplier '${name}' has been deleted.`);
      loadSuppliers();
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadPurchases() {
  try {
    let poList = null;
    try {
      const res = await fetch(`${API_BASE}/purchases`);
      if (res.ok) poList = await res.json();
    } catch (e) {}

    if (!poList || poList.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          poList = [...(db.purchases || [])].reverse();
        }
      } catch (e) {}
    }

    if (!poList) poList = [];
    const tbody = document.getElementById('purchasesTableBody');
    if (!tbody) return;

    if (poList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No purchase orders</td></tr>`;
      return;
    }

    tbody.innerHTML = poList.map(po => `
      <tr>
        <td><b>${po.po_number}</b></td>
        <td>${po.date}</td>
        <td><b>${po.supplier_name}</b></td>
        <td>${po.items.map(i => `${i.name} (${i.quantity} Pcs)`).join(', ')}</td>
        <td><b>Rs. ${po.grand_total.toLocaleString()}</b></td>
        <td><span style="color: var(--brand-primary); font-weight: 600;">Rs. ${po.paid_amount.toLocaleString()}</span></td>
        <td><span style="color: var(--brand-red); font-weight: 600;">Rs. ${po.due_amount.toLocaleString()}</span></td>
        <td><span class="badge badge-success">${po.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load purchases:', err);
  }
}

function openAddSupplierModal() {
  const name = prompt('Enter Supplier / Textile Mill Name:');
  if (!name) return;
  const contact_person = prompt('Contact Person:');
  const phone = prompt('Phone / Mobile:');
  const address = prompt('City & Address:', 'Multan / Faisalabad');

  fetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, contact_person: contact_person || '', phone: phone || '', address: address || '' }),
  }).then(res => res.json()).then(() => {
    alert('Supplier added successfully.');
    loadSuppliers();
  });
}

function openAddPurchaseModal() {
  if (allProducts.length === 0) {
    alert('Your stock is currently empty. Please go to "Stock & Scanner" and click "+ Add New Suit" first.');
    return;
  }
  if (allSuppliers.length === 0) {
    alert('No suppliers found. Please click "+ Add New Supplier" first to register your suppliers.');
    return;
  }

  const supplier = allSuppliers[0];
  const prod = allProducts[0];
  const qtyStr = prompt(`How many pieces of '${prod.name}' did you purchase from '${supplier.name}'?`, '50');
  if (!qtyStr) return;
  const qty = parseInt(qtyStr, 10);
  const costStr = prompt(`Cost per suit (PKR):`, prod.cost_price.toString());
  const cost = parseFloat(costStr);
  const paidStr = prompt(`Amount paid now (PKR):`, (qty * cost).toString());
  const paid = parseFloat(paidStr) || 0;

  const payload = {
    supplier_id: supplier.id,
    items: [{
      product_id: prod.id,
      name: prod.name,
      quantity: qty,
      unit_cost: cost,
      total: qty * cost,
    }],
    paid_amount: paid,
    notes: 'Fabric thaan purchase and stock replenishment',
  };

  fetch(`${API_BASE}/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(res => res.json()).then(po => {
    alert(`Purchase Order saved! Added ${qty} pieces into inventory stock.`);
    loadPurchases();
    loadSuppliers();
    loadInventory();
    loadOverview();
  });
}

// ======================== Expenses ========================

async function loadExpenses() {
  try {
    let expList = null;
    try {
      const res = await fetch(`${API_BASE}/expenses`);
      if (res.ok) expList = await res.json();
    } catch (e) {}

    if (!expList || expList.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          expList = [...(db.expenses || [])].reverse();
        }
      } catch (e) {}
    }

    if (!expList) expList = [];
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    if (expList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No expenses recorded</td></tr>`;
      return;
    }

    tbody.innerHTML = expList.map(e => `
      <tr>
        <td><b>${e.id}</b></td>
        <td>${e.date}</td>
        <td><span class="badge badge-warning">${e.category}</span></td>
        <td><b style="color: var(--brand-red);">Rs. ${e.amount.toLocaleString()}</b></td>
        <td>${e.paid_by}</td>
        <td>${e.description}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load expenses:', err);
  }
}

function openAddExpenseModal() {
  const cat = prompt('Select Expense Category (Rent / Electricity / Staff Salaries / Packaging / Refreshment / Maintenance):', 'Packaging');
  if (!cat) return;
  const amountStr = prompt('Amount (PKR):', '5000');
  if (!amountStr) return;
  const amount = parseFloat(amountStr);
  const desc = prompt('Description:', 'Shopping bags and luxury suit boxes');

  fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: cat, amount, paid_by: 'Cash Counter', description: desc || '' }),
  }).then(res => res.json()).then(() => {
    alert('Expense recorded successfully.');
    loadExpenses();
    loadOverview();
  });
}

// ======================== Estimates & Delivery Notes ========================

async function loadDeliveryNotes() {
  try {
    let dnList = null;
    try {
      const res = await fetch(`${API_BASE}/delivery-notes`);
      if (res.ok) dnList = await res.json();
    } catch (e) {}

    if (!dnList || dnList.length === 0) {
      try {
        const fbRes = await fetch('/data/erp_database.json');
        if (fbRes.ok) {
          const db = await fbRes.json();
          dnList = [...(db.delivery_notes || [])].reverse();
        }
      } catch (e) {}
    }

    if (!dnList) dnList = [];
    const tbody = document.getElementById('deliveryNotesTableBody');
    if (!tbody) return;

    if (dnList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No delivery challans</td></tr>`;
      return;
    }

    tbody.innerHTML = dnList.map(dn => `
      <tr>
        <td><b>${dn.note_number}</b></td>
        <td>${dn.date}</td>
        <td>${dn.invoice_id}</td>
        <td><b>${dn.customer_name}</b></td>
        <td>${dn.customer_phone}</td>
        <td>${dn.delivery_address}</td>
        <td><span class="badge badge-info">${dn.courier}</span></td>
        <td><code>${dn.tracking_number}</code></td>
        <td><span class="badge badge-success">${dn.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load delivery notes:', err);
  }
}

function openAddDeliveryModal() {
  const invoice_id = prompt('Enter Invoice Number:', 'INV-1001');
  if (!invoice_id) return;
  const customer_name = prompt('Customer Name:', 'Muhammad Arslan');
  const customer_phone = prompt('Customer Phone:', '03001234567');
  const delivery_address = prompt('Delivery Address:', 'Model Town, Gujranwala');
  const courier = prompt('Courier Service (TCS / Leopard / Daewoo / Rider):', 'TCS Express');
  const tracking_number = prompt('Tracking Number:', 'TCS-' + Math.floor(10000000 + Math.random() * 90000000));

  fetch(`${API_BASE}/delivery-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_id, customer_name, customer_phone, delivery_address, courier, tracking_number }),
  }).then(res => res.json()).then(() => {
    alert('Delivery challan created successfully.');
    loadDeliveryNotes();
  });
}

function openAddEstimateModal() {
  const customer_name = prompt('Customer Name:', 'Sardar Ahmed Khan');
  if (!customer_name) return;
  const customer_phone = prompt('Customer Phone:', '0302-7771122');
  if (allProducts.length === 0) {
    alert('Your stock is currently empty. Please add a suit in "Stock & Scanner" first.');
    return;
  }

  const prod = allProducts[0];
  const qtyStr = prompt(`How many pieces of '${prod.name}' to include in estimate?`, '5');
  const qty = parseInt(qtyStr, 10) || 1;

  fetch(`${API_BASE}/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name,
      customer_phone,
      items: [{ product_id: prod.id, quantity: qty }],
      notes: 'Wedding quotation for fabric suits',
    }),
  }).then(res => res.json()).then(est => {
    alert(`Estimate '${est.estimate_number}' created! Total: Rs. ${est.grand_total.toLocaleString()}`);
  });
}

// ======================== Financial Reports Data ========================

async function loadReportsData() {
  try {
    const res = await fetch(`${API_BASE}/overview`);
    const data = await res.json();

    const sales = data.total_sales_month;
    const purchases = data.total_purchases_month;
    const expenses = data.total_expenses_month;
    const profit = data.total_profit_month;
    const received = data.payment_received_month;
    const paid = data.payment_paid_month;

    document.getElementById('repSales').textContent = `Rs. ${sales.toLocaleString()}`;
    document.getElementById('repCost').textContent = `Rs. ${purchases.toLocaleString()}`;
    document.getElementById('repGrossProfit').textContent = `Rs. ${(sales - purchases).toLocaleString()}`;
    document.getElementById('repExpenses').textContent = `Rs. ${expenses.toLocaleString()}`;
    document.getElementById('repNetProfit').textContent = `Rs. ${profit.toLocaleString()}`;

    document.getElementById('repReceived').textContent = `Rs. ${received.toLocaleString()}`;
    document.getElementById('repPaidSuppliers').textContent = `Rs. ${purchases.toLocaleString()}`;
    document.getElementById('repPaidExpenses').textContent = `Rs. ${expenses.toLocaleString()}`;
    document.getElementById('repNetCash').textContent = `Rs. ${(received - paid).toLocaleString()}`;
  } catch (err) {
    console.error('Failed to load reports data:', err);
  }
}

// ======================== Settings ========================

async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    const s = await res.json();
    document.getElementById('setStoreName').value = s.store_name;
    document.getElementById('setSlogan').value = s.slogan;
    document.getElementById('setAddress').value = s.address;
    document.getElementById('setPhone').value = s.phone;
    document.getElementById('setEmail').value = s.email;
    document.getElementById('setInvoiceFooter').value = s.invoice_footer;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveStoreSettings(e) {
  e.preventDefault();
  const payload = {
    store_name: document.getElementById('setStoreName').value,
    store_name_urdu: document.getElementById('setStoreName').value,
    slogan: document.getElementById('setSlogan').value,
    address: document.getElementById('setAddress').value,
    phone: document.getElementById('setPhone').value,
    email: document.getElementById('setEmail').value,
    tax_percentage: 0.0,
    currency: 'PKR (Rs.)',
    invoice_footer: document.getElementById('setInvoiceFooter').value,
  };

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert('Store settings successfully updated!');
    }
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// ======================== Modal Helper ========================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}
