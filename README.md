# Clothing Store - Enterprise ERP & POS System

An enterprise-grade, high-performance Retail Management and Cloud ERP System engineered specifically for **Clothing Store**. Featuring real-time inventory tracking, quick barcode POS billing, customer suit return/exchange engines, supplier purchase ledgers, expense tracking, and instant thermal receipt printing.

---

## 🌐 Quick Links & Access

- **Local ERP Portal**: [http://localhost:8080](http://localhost:8080)
- **One-Click Windows Launcher**: Double-click [START_STORE_ERP.bat](file:///c:/CLOTHING%20ERP%20SYSTEM/START_STORE_ERP.bat)
- **GitHub Repository**: [https://github.com/hamoodsamad/Clothing-Store-ERP](https://github.com/hamoodsamad/Clothing-Store-ERP)
- **Vercel Cloud Deployment**: Ready for 1-click deployment with serverless Python backend and CDN static frontend.

---

## 🌟 Initial State (Day 1 Zero-Start Architecture)

The system starts in a 100% clean, blank slate state (Day 1):
* **Products in Stock**: `0 items` (Completely empty - ready for your inventory)
* **Total Stock Units**: `0 Pcs`
* **Total Sales This Month**: `Rs. 0`
* **Total Purchases This Month**: `Rs. 0`
* **Net Profit This Month**: `Rs. 0`
* **Payments Received**: `Rs. 0`
* **Payments Paid**: `Rs. 0`
* **Shop Expenses**: `Rs. 0`
* **Customer Database**: `0 customers`
* **Invoices / Bills**: `0 issued`
* **Interactive Graphs & Charts**: Cleanly initialized at `0`, dynamically rendering real-time curves and bars as sales occur.

---

## ⚡ Deployment to Vercel (1-Click Cloud Hosting)

This project is pre-configured with `vercel.json` and `api/index.py` serverless functions for effortless deployment on [Vercel](https://vercel.com):

1. **Sign in to Vercel**: Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. **Add New Project**: Click **"Add New..."** -> **"Project"**.
3. **Import GitHub Repository**: Select `Clothing-Store-ERP` from your GitHub repositories.
4. **Deploy**: Leave all build settings as default (Framework Preset: **Other**) and click **"Deploy"**.
5. Within 30 seconds, your Clothing Store ERP will be live on your custom `.vercel.app` domain!

---

## 🚀 How to Run Locally

### Option 1: Double-Click Launcher (Windows)
Simply double click [START_STORE_ERP.bat](file:///c:/CLOTHING%20ERP%20SYSTEM/START_STORE_ERP.bat) in the root directory. It will start the server and automatically launch your default browser to [http://localhost:8080](http://localhost:8080).

### Option 2: Terminal / PowerShell
```powershell
cd "c:\CLOTHING ERP SYSTEM"
python run_server.py
```
Open your browser and navigate to:
👉 **`http://localhost:8080`**

---

## 🎯 Key Features & Modules

### 1. 📦 Product Management with Delete Feature (اضافہ اور ڈیلیٹ)
* **Add New Product (`+ Add New Suit`)**: Add custom suits, unstitched fabrics, latha, boski, karandi, and kurta sets with custom Barcode/SKU, Wholesale Cost, Retail Price, Color, and Cut.
* **Delete Product (`🗑️ Delete`)**: Any product can be permanently deleted from the inventory table with a single click and safety confirmation prompt.
* **Restock via Scanner (`➕ Restock`)**: Scan any suit's barcode to add new quantities upon arrival from suppliers.

### 2. 🛒 Point of Sale & Quick Billing (کاؤنٹر سیل)
* **Instant Barcode Scanning**: Scan barcodes directly from fabric rolls or suit tags into the checkout cart.
* **Smart Customer Search**: Automatically look up existing customers or create new customer profiles on the fly.
* **Discounts & Multi-Pay**: Support for custom item prices, bill-level discounts, cash, bank transfer, and credit accounts.
* **Thermal Receipt Printing**: Generates clean 80mm thermal receipts with store logo, Urdu/English bilingual branding, barcode, item breakdown, and return policy.

### 3. 🔄 Customer Returns & Suit Exchange (ریٹرن اور ایکسچینج)
* **Two Dedicated Modes**:
  1. **Suit Exchange / Restock**: Exchanges the suit and automatically puts it back into inventory without financial penalty.
  2. **Cash / Payment Refund**: Deducts the refund from the store ledger and restocks the suit.
* **Direct Return Access**: Look up any invoice or customer, view sold items, and click **"Return / Exchange"** to process immediately.

### 4. 📊 Real-Time Analytics & Profit Tracking
* Monthly Sales, Purchases, Net Profit, and Expense metrics update dynamically with every single transaction.
* Interactive Chart.js graphs visualize daily cashflow and revenue.

---

## 📁 Project Structure

```
CLOTHING ERP SYSTEM/
├── api/
│   └── index.py            # Vercel Serverless Function (Python REST API)
├── public/                 # Production CDN Static Frontend
│   ├── index.html          # Single Page Application UI
│   ├── styles.css          # Responsive styling (Light / Dark mode)
│   ├── app.js              # Application core engine
│   └── images/
│       ├── logo.svg        # Clean vector corporate emblem
│       └── logo.jpg        # High-resolution luxury gold logo
├── static/                 # Local Static Frontend mirror
├── data/
│   └── erp_database.json   # Zero-start database seed
├── START_STORE_ERP.bat     # Windows 1-click launcher
├── run_server.py           # Multi-threaded local Python server
├── vercel.json             # Vercel serverless deployment routing
├── requirements.txt        # Deployment dependencies manifest
└── README.md               # Documentation & deployment guide
```

---

© 2026 Clothing Store ERP System. All Rights Reserved.
