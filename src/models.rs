use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub barcode: String,
    pub name: String,
    pub category: String,
    pub fabric: String,
    pub color: String,
    pub size: String,
    pub cost_price: f64,
    pub selling_price: f64,
    pub stock_quantity: i32,
    pub min_stock_alert: i32,
    pub supplier_id: Option<String>,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub address: String,
    pub city: String,
    pub total_purchases: f64,
    pub total_orders: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: String,
    pub name: String,
    pub contact_person: String,
    pub phone: String,
    pub address: String,
    pub balance_payable: f64,
    pub total_purchased: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub product_id: String,
    pub barcode: String,
    pub name: String,
    pub color: String,
    pub quantity: i32,
    pub unit_cost: f64,
    pub unit_price: f64,
    pub total: f64,
    pub profit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: String,
    pub invoice_number: String,
    pub customer_id: Option<String>,
    pub customer_name: String,
    pub customer_phone: String,
    pub date: String,
    pub items: Vec<InvoiceItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub tax: f64,
    pub grand_total: f64,
    pub total_cost: f64,
    pub total_profit: f64,
    pub payment_method: String, // "Cash", "Card", "Bank Transfer", "Credit"
    pub amount_paid: f64,
    pub change_due: f64,
    pub status: String, // "Paid", "Partially Paid", "Returned"
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Estimate {
    pub id: String,
    pub estimate_number: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub date: String,
    pub valid_until: String,
    pub items: Vec<InvoiceItem>,
    pub grand_total: f64,
    pub status: String, // "Pending", "Accepted", "Converted", "Expired"
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseItem {
    pub product_id: String,
    pub name: String,
    pub quantity: i32,
    pub unit_cost: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: String,
    pub po_number: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub date: String,
    pub items: Vec<PurchaseItem>,
    pub grand_total: f64,
    pub paid_amount: f64,
    pub due_amount: f64,
    pub status: String, // "Received", "Pending", "Cancelled"
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: String,
    pub category: String, // "Rent", "Electricity", "Staff Salaries", "Packaging", "Marketing", "Refreshment", "Maintenance"
    pub amount: f64,
    pub date: String,
    pub paid_by: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReturn {
    pub id: String,
    pub invoice_id: String,
    pub customer_name: String,
    pub product_id: String,
    pub product_name: String,
    pub quantity: i32,
    pub refund_amount: f64,
    pub return_type: String, // "Suit Restocked (Exchange)" or "Cash Refunded to Customer"
    pub reason: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturn {
    pub id: String,
    pub purchase_id: String,
    pub supplier_name: String,
    pub product_id: String,
    pub product_name: String,
    pub quantity: i32,
    pub amount: f64,
    pub reason: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryNote {
    pub id: String,
    pub note_number: String,
    pub invoice_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub delivery_address: String,
    pub courier: String,
    pub tracking_number: String,
    pub status: String, // "Dispatched", "In Transit", "Delivered"
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreAgent {
    pub id: String,
    pub name: String,
    pub role: String, // "Admin / Owner", "Cashier", "Sales Agent", "Store Keeper"
    pub phone: String,
    pub email: String,
    pub status: String, // "Active", "Inactive"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreSettings {
    pub store_name: String,
    pub store_name_urdu: String,
    pub slogan: String,
    pub address: String,
    pub phone: String,
    pub email: String,
    pub tax_percentage: f64,
    pub currency: String,
    pub invoice_footer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErpDatabase {
    pub store_settings: StoreSettings,
    pub products: Vec<Product>,
    pub customers: Vec<Customer>,
    pub suppliers: Vec<Supplier>,
    pub invoices: Vec<Invoice>,
    pub estimates: Vec<Estimate>,
    pub purchases: Vec<PurchaseOrder>,
    pub expenses: Vec<Expense>,
    pub sales_returns: Vec<SaleReturn>,
    pub purchase_returns: Vec<PurchaseReturn>,
    pub delivery_notes: Vec<DeliveryNote>,
    pub agents: Vec<StoreAgent>,
}
