use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::db::{save_db_to_disk, DbState};
use crate::models::*;

// ======================== Overview & Analytics ========================

#[derive(Clone, Serialize)]
pub struct ProductSalesRank {
    pub id: String,
    pub barcode: String,
    pub name: String,
    pub category: String,
    pub current_stock: i32,
    pub units_sold: i32,
    pub total_revenue: f64,
    pub total_profit: f64,
}

#[derive(Serialize)]
pub struct DashboardOverview {
    pub store_name: String,
    pub store_name_urdu: String,
    pub month_name: String,
    pub total_sales_month: f64,
    pub total_purchases_month: f64,
    pub total_profit_month: f64,
    pub payment_received_month: f64,
    pub payment_paid_month: f64,
    pub total_expenses_month: f64,
    pub total_stock_units: i32,
    pub total_stock_value_cost: f64,
    pub total_stock_value_retail: f64,
    pub low_stock_count: usize,
    pub out_of_stock_count: usize,
    pub total_customers: usize,
    pub total_invoices_count: usize,
    pub best_selling_suits: Vec<ProductSalesRank>,
    pub slowest_selling_suits: Vec<ProductSalesRank>,
    pub recent_invoices: Vec<Invoice>,
}

pub async fn get_overview(State(db_state): State<DbState>) -> impl IntoResponse {
    let db = db_state.read().await;
    let current_month = chrono::Local::now().format("%Y-%m").to_string();
    let month_name = chrono::Local::now().format("%B %Y").to_string();

    let mut total_sales_month = 0.0;
    let mut total_profit_month = 0.0;
    let mut payment_received_month = 0.0;

    // Track sales per product
    let mut product_sales: HashMap<String, (i32, f64, f64)> = HashMap::new(); // units, revenue, profit

    for inv in &db.invoices {
        if inv.date.starts_with(&current_month) {
            total_sales_month += inv.grand_total;
            total_profit_month += inv.total_profit;
            payment_received_month += inv.amount_paid;
        }

        for item in &inv.items {
            let entry = product_sales.entry(item.product_id.clone()).or_insert((0, 0.0, 0.0));
            entry.0 += item.quantity;
            entry.1 += item.total;
            entry.2 += item.profit;
        }
    }

    let mut total_purchases_month = 0.0;
    let mut payment_paid_suppliers_month = 0.0;
    for po in &db.purchases {
        if po.date.starts_with(&current_month) {
            total_purchases_month += po.grand_total;
            payment_paid_suppliers_month += po.paid_amount;
        }
    }

    let mut total_expenses_month = 0.0;
    for exp in &db.expenses {
        if exp.date.starts_with(&current_month) {
            total_expenses_month += exp.amount;
        }
    }

    let payment_paid_month = payment_paid_suppliers_month + total_expenses_month;
    let net_profit_month = total_profit_month - total_expenses_month;

    let mut total_stock_units = 0;
    let mut total_stock_value_cost = 0.0;
    let mut total_stock_value_retail = 0.0;
    let mut low_stock_count = 0;
    let mut out_of_stock_count = 0;

    let mut all_ranks: Vec<ProductSalesRank> = Vec::new();

    for p in &db.products {
        total_stock_units += p.stock_quantity;
        total_stock_value_cost += p.cost_price * (p.stock_quantity as f64);
        total_stock_value_retail += p.selling_price * (p.stock_quantity as f64);

        if p.stock_quantity == 0 {
            out_of_stock_count += 1;
        } else if p.stock_quantity <= p.min_stock_alert {
            low_stock_count += 1;
        }

        let (units, rev, prof) = product_sales.get(&p.id).cloned().unwrap_or((0, 0.0, 0.0));
        all_ranks.push(ProductSalesRank {
            id: p.id.clone(),
            barcode: p.barcode.clone(),
            name: p.name.clone(),
            category: p.category.clone(),
            current_stock: p.stock_quantity,
            units_sold: units,
            total_revenue: rev,
            total_profit: prof,
        });
    }

    // Sort for best sellers
    let mut best_selling = all_ranks.clone();
    best_selling.sort_by(|a, b| b.units_sold.cmp(&a.units_sold));
    best_selling.truncate(5);

    // Sort for slowest sellers
    let mut slowest_selling = all_ranks;
    slowest_selling.sort_by(|a, b| a.units_sold.cmp(&b.units_sold));
    slowest_selling.truncate(5);

    let mut recent_invs = db.invoices.clone();
    recent_invs.reverse();
    recent_invs.truncate(6);

    let overview = DashboardOverview {
        store_name: db.store_settings.store_name.clone(),
        store_name_urdu: db.store_settings.store_name_urdu.clone(),
        month_name,
        total_sales_month,
        total_purchases_month,
        total_profit_month: net_profit_month,
        payment_received_month,
        payment_paid_month,
        total_expenses_month,
        total_stock_units,
        total_stock_value_cost,
        total_stock_value_retail,
        low_stock_count,
        out_of_stock_count,
        total_customers: db.customers.len(),
        total_invoices_count: db.invoices.len(),
        best_selling_suits: best_selling,
        slowest_selling_suits: slowest_selling,
        recent_invoices: recent_invs,
    };

    Json(overview)
}

// ======================== Products & Inventory ========================

#[derive(Deserialize)]
pub struct ProductFilter {
    pub search: Option<String>,
    pub category: Option<String>,
    pub low_stock: Option<bool>,
}

pub async fn list_products(
    Query(filter): Query<ProductFilter>,
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut prods = db.products.clone();

    if let Some(search) = filter.search {
        let s = search.to_lowercase();
        prods.retain(|p| {
            p.name.to_lowercase().contains(&s)
                || p.barcode.to_lowercase().contains(&s)
                || p.color.to_lowercase().contains(&s)
                || p.fabric.to_lowercase().contains(&s)
        });
    }

    if let Some(cat) = filter.category {
        if !cat.is_empty() && cat != "All" {
            prods.retain(|p| p.category == cat);
        }
    }

    if let Some(low) = filter.low_stock {
        if low {
            prods.retain(|p| p.stock_quantity <= p.min_stock_alert);
        }
    }

    Json(prods)
}

pub async fn get_product_by_barcode(
    Path(barcode): Path<String>,
    State(db_state): State<DbState>,
) -> Result<Json<Product>, StatusCode> {
    let db = db_state.read().await;
    let trimmed = barcode.trim().to_lowercase();
    if let Some(p) = db.products.iter().find(|p| p.barcode.to_lowercase() == trimmed || p.id.to_lowercase() == trimmed) {
        Ok(Json(p.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize)]
pub struct CreateProductPayload {
    pub barcode: Option<String>,
    pub name: String,
    pub category: String,
    pub fabric: String,
    pub color: String,
    pub size: String,
    pub cost_price: f64,
    pub selling_price: f64,
    pub stock_quantity: i32,
    pub min_stock_alert: Option<i32>,
    pub supplier_id: Option<String>,
    pub description: Option<String>,
}

pub async fn create_product(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateProductPayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let count = db.products.len() + 1001;
    let id = format!("PRD-{}", count);

    // If barcode not provided, generate an 8-digit unique barcode
    let barcode = payload.barcode.filter(|b| !b.trim().is_empty()).unwrap_or_else(|| {
        format!("890{:04}", count)
    });

    let product = Product {
        id,
        barcode,
        name: payload.name,
        category: payload.category,
        fabric: payload.fabric,
        color: payload.color,
        size: payload.size,
        cost_price: payload.cost_price,
        selling_price: payload.selling_price,
        stock_quantity: payload.stock_quantity,
        min_stock_alert: payload.min_stock_alert.unwrap_or(10),
        supplier_id: payload.supplier_id,
        description: payload.description.unwrap_or_default(),
        created_at: now.clone(),
        updated_at: now,
    };

    db.products.push(product.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(product))
}

#[derive(Deserialize)]
pub struct UpdateProductPayload {
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
    pub description: String,
}

pub async fn update_product(
    Path(id): Path<String>,
    State(db_state): State<DbState>,
    Json(payload): Json<UpdateProductPayload>,
) -> Result<Json<Product>, StatusCode> {
    let mut db = db_state.write().await;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if let Some(p) = db.products.iter_mut().find(|p| p.id == id) {
        p.barcode = payload.barcode;
        p.name = payload.name;
        p.category = payload.category;
        p.fabric = payload.fabric;
        p.color = payload.color;
        p.size = payload.size;
        p.cost_price = payload.cost_price;
        p.selling_price = payload.selling_price;
        p.stock_quantity = payload.stock_quantity;
        p.min_stock_alert = payload.min_stock_alert;
        p.description = payload.description;
        p.updated_at = now;
        let updated = p.clone();
        drop(db);
        save_db_to_disk(&db_state).await;
        Ok(Json(updated))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_product(
    Path(id): Path<String>,
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    db.products.retain(|p| p.id != id);
    drop(db);
    save_db_to_disk(&db_state).await;
    StatusCode::NO_CONTENT
}

// Restock Scanner Mode (Adds count when scanned in Restock mode)
#[derive(Deserialize)]
pub struct RestockPayload {
    pub barcode: String,
    pub quantity_to_add: i32,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct RestockResponse {
    pub success: bool,
    pub product: Product,
    pub added_quantity: i32,
    pub new_total_stock: i32,
    pub message: String,
}

pub async fn restock_by_scanner(
    State(db_state): State<DbState>,
    Json(payload): Json<RestockPayload>,
) -> Result<Json<RestockResponse>, (StatusCode, String)> {
    let mut db = db_state.write().await;
    let trimmed = payload.barcode.trim().to_lowercase();
    let qty = if payload.quantity_to_add <= 0 { 1 } else { payload.quantity_to_add };

    if let Some(p) = db.products.iter_mut().find(|p| p.barcode.to_lowercase() == trimmed || p.id.to_lowercase() == trimmed) {
        p.stock_quantity += qty;
        p.updated_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let prod_clone = p.clone();
        let new_total = p.stock_quantity;
        drop(db);
        save_db_to_disk(&db_state).await;

        Ok(Json(RestockResponse {
            success: true,
            product: prod_clone,
            added_quantity: qty,
            new_total_stock: new_total,
            message: format!("اسٹاک میں {} پیسز کا اضافہ کر دیا گیا ہے۔ کل اسٹاک اب: {}", qty, new_total),
        }))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            format!("بارکوڈ '{}' والا سوٹ ڈیٹا بیس میں موجود نہیں ہے۔", payload.barcode),
        ))
    }
}

// ======================== Point of Sale (POS) ========================

#[derive(Deserialize)]
pub struct CartItemInput {
    pub product_id: String,
    pub quantity: i32,
    pub custom_price: Option<f64>,
}

#[derive(Deserialize)]
pub struct PosCheckoutPayload {
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_city: Option<String>,
    pub items: Vec<CartItemInput>,
    pub discount: Option<f64>,
    pub tax_percentage: Option<f64>,
    pub payment_method: String, // "Cash", "Card", "Bank Transfer", "Credit"
    pub amount_paid: f64,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct CheckoutResponse {
    pub success: bool,
    pub invoice: Invoice,
    pub message: String,
}

pub async fn pos_checkout(
    State(db_state): State<DbState>,
    Json(payload): Json<PosCheckoutPayload>,
) -> Result<Json<CheckoutResponse>, (StatusCode, String)> {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now_full = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if payload.items.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "بل میں کوئی پراڈکٹ شامل نہیں ہے۔".to_string()));
    }

    // Check stock availability first
    for item_input in &payload.items {
        let p = db.products.iter().find(|p| p.id == item_input.product_id);
        match p {
            Some(prod) => {
                if prod.stock_quantity < item_input.quantity {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        format!(
                            "پراڈکٹ '{}' کا مطلوبہ اسٹاک ناکافی ہے۔ موجودہ اسٹاک صرف {} پیسز ہے۔",
                            prod.name, prod.stock_quantity
                        ),
                    ));
                }
            }
            None => {
                return Err((
                    StatusCode::NOT_FOUND,
                    format!("پراڈکٹ ID '{}' تلاش نہیں ہو سکی۔", item_input.product_id),
                ));
            }
        }
    }

    // Build Invoice Items & DEDUCT Stock immediately!
    let mut invoice_items: Vec<InvoiceItem> = Vec::new();
    let mut subtotal = 0.0;
    let mut total_cost = 0.0;

    for item_input in &payload.items {
        if let Some(prod) = db.products.iter_mut().find(|p| p.id == item_input.product_id) {
            // Deduct stock!
            prod.stock_quantity -= item_input.quantity;
            prod.updated_at = now_full.clone();

            let unit_price = item_input.custom_price.unwrap_or(prod.selling_price);
            let item_total = unit_price * (item_input.quantity as f64);
            let item_cost = prod.cost_price * (item_input.quantity as f64);
            let item_profit = item_total - item_cost;

            subtotal += item_total;
            total_cost += item_cost;

            invoice_items.push(InvoiceItem {
                product_id: prod.id.clone(),
                barcode: prod.barcode.clone(),
                name: prod.name.clone(),
                color: prod.color.clone(),
                quantity: item_input.quantity,
                unit_cost: prod.cost_price,
                unit_price,
                total: item_total,
                profit: item_profit,
            });
        }
    }

    let discount = payload.discount.unwrap_or(0.0);
    let tax_pct = payload.tax_percentage.unwrap_or(0.0);
    let after_discount = (subtotal - discount).max(0.0);
    let tax_amount = after_discount * (tax_pct / 100.0);
    let grand_total = after_discount + tax_amount;
    let total_profit = (grand_total - total_cost).max(0.0);

    let amount_paid = payload.amount_paid;
    let change_due = if amount_paid > grand_total { amount_paid - grand_total } else { 0.0 };

    // Find or create customer
    let cust_phone = payload.customer_phone.trim().to_string();
    let cust_name = if payload.customer_name.trim().is_empty() {
        "Walk-in Customer (کاؤنٹر کسٹمر)".to_string()
    } else {
        payload.customer_name.trim().to_string()
    };

    let mut customer_id = None;
    if !cust_phone.is_empty() {
        if let Some(c) = db.customers.iter_mut().find(|c| c.phone == cust_phone || (!cust_name.is_empty() && c.name.to_lowercase() == cust_name.to_lowercase())) {
            c.total_purchases += grand_total;
            c.total_orders += 1;
            customer_id = Some(c.id.clone());
        } else {
            let new_c_id = format!("CUST-{:03}", db.customers.len() + 1);
            let new_cust = Customer {
                id: new_c_id.clone(),
                name: cust_name.clone(),
                phone: cust_phone.clone(),
                address: payload.customer_city.clone().unwrap_or_else(|| "گوجرانوالہ".to_string()),
                city: payload.customer_city.unwrap_or_else(|| "گوجرانوالہ".to_string()),
                total_purchases: grand_total,
                total_orders: 1,
                created_at: now_full.clone(),
            };
            customer_id = Some(new_c_id);
            db.customers.push(new_cust);
        }
    }

    let invoice_count = db.invoices.len() + 1001;
    let invoice_id = format!("INV-{}", invoice_count);
    let invoice_number = format!("INV-{:04}", invoice_count);

    let invoice = Invoice {
        id: invoice_id,
        invoice_number,
        customer_id,
        customer_name: cust_name,
        customer_phone: cust_phone,
        date: today,
        items: invoice_items,
        subtotal,
        discount,
        tax: tax_amount,
        grand_total,
        total_cost,
        total_profit,
        payment_method: payload.payment_method,
        amount_paid,
        change_due,
        status: "Paid".to_string(),
        notes: payload.notes.unwrap_or_default(),
    };

    db.invoices.push(invoice.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    Ok(Json(CheckoutResponse {
        success: true,
        invoice,
        message: "سیل کامیابی کے ساتھ مکمل ہوگئی اور اسٹاک اپ ڈیٹ کر دیا گیا ہے۔".to_string(),
    }))
}

// ======================== Customer History & Returns ========================

#[derive(Serialize)]
pub struct CustomerHistoryItem {
    pub invoice_id: String,
    pub invoice_number: String,
    pub date: String,
    pub product_id: String,
    pub product_name: String,
    pub barcode: String,
    pub color: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total: f64,
}

#[derive(Serialize)]
pub struct CustomerDetailResponse {
    pub customer: Customer,
    pub purchase_history: Vec<CustomerHistoryItem>,
    pub invoices: Vec<Invoice>,
}

pub async fn get_customer_details(
    Path(id_or_phone): Path<String>,
    State(db_state): State<DbState>,
) -> Result<Json<CustomerDetailResponse>, StatusCode> {
    let db = db_state.read().await;
    let search = id_or_phone.trim().to_lowercase();

    let cust = db.customers.iter().find(|c| {
        c.id.to_lowercase() == search
            || c.phone.to_lowercase() == search
            || c.name.to_lowercase().contains(&search)
    });

    if let Some(customer) = cust {
        let mut history: Vec<CustomerHistoryItem> = Vec::new();
        let mut cust_invoices: Vec<Invoice> = Vec::new();

        for inv in &db.invoices {
            let is_match = inv.customer_id.as_ref() == Some(&customer.id)
                || inv.customer_phone == customer.phone
                || inv.customer_name.to_lowercase() == customer.name.to_lowercase();

            if is_match {
                cust_invoices.push(inv.clone());
                for itm in &inv.items {
                    history.push(CustomerHistoryItem {
                        invoice_id: inv.id.clone(),
                        invoice_number: inv.invoice_number.clone(),
                        date: inv.date.clone(),
                        product_id: itm.product_id.clone(),
                        product_name: itm.name.clone(),
                        barcode: itm.barcode.clone(),
                        color: itm.color.clone(),
                        quantity: itm.quantity,
                        unit_price: itm.unit_price,
                        total: itm.total,
                    });
                }
            }
        }

        Ok(Json(CustomerDetailResponse {
            customer: customer.clone(),
            purchase_history: history,
            invoices: cust_invoices,
        }))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn list_customers(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    Json(db.customers.clone())
}

#[derive(Deserialize)]
pub struct CreateCustomerPayload {
    pub name: String,
    pub phone: String,
    pub address: Option<String>,
    pub city: Option<String>,
}

pub async fn create_customer(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateCustomerPayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let id = format!("CUST-{:03}", db.customers.len() + 1);

    let customer = Customer {
        id,
        name: payload.name,
        phone: payload.phone,
        address: payload.address.unwrap_or_default(),
        city: payload.city.unwrap_or_else(|| "گوجرانوالہ".to_string()),
        total_purchases: 0.0,
        total_orders: 0,
        created_at: now,
    };

    db.customers.push(customer.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(customer))
}

// ======================== Returns & Refunds ========================

#[derive(Deserialize)]
pub struct ProcessReturnPayload {
    pub invoice_id: String,
    pub product_id: String,
    pub quantity: i32,
    pub return_type: String, // "SUIT_EXCHANGE" (سوٹ ریٹرن / تبادلہ) or "CASH_REFUND" (پیمنٹ واپس)
    pub reason: Option<String>,
}

#[derive(Serialize)]
pub struct ProcessReturnResponse {
    pub success: bool,
    pub sale_return: SaleReturn,
    pub restocked_quantity: i32,
    pub message: String,
}

pub async fn process_sale_return(
    State(db_state): State<DbState>,
    Json(payload): Json<ProcessReturnPayload>,
) -> Result<Json<ProcessReturnResponse>, (StatusCode, String)> {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let invoice = match db.invoices.iter().find(|inv| inv.id == payload.invoice_id || inv.invoice_number == payload.invoice_id) {
        Some(inv) => inv.clone(),
        None => return Err((StatusCode::NOT_FOUND, "انوائس ریکارڈ میں نہیں ملی۔".to_string())),
    };

    let item = match invoice.items.iter().find(|i| i.product_id == payload.product_id) {
        Some(i) => i.clone(),
        None => return Err((StatusCode::NOT_FOUND, "یہ سوٹ اس انوائس میں شامل نہیں تھا۔".to_string())),
    };

    let qty = payload.quantity.min(item.quantity).max(1);
    let refund_amount = item.unit_price * (qty as f64);

    let is_suit_exchange = payload.return_type.to_uppercase() == "SUIT_EXCHANGE" || payload.return_type.contains("سوٹ");
    let return_type_label = if is_suit_exchange {
        "سوٹ ریٹرن / تبادلہ (Restocked Suit / Exchange)".to_string()
    } else {
        "پیمنٹ واپس / رقم کی واپسی (Cash Refund)".to_string()
    };

    // 1. Restock the suit back into inventory!
    if let Some(prod) = db.products.iter_mut().find(|p| p.id == payload.product_id) {
        prod.stock_quantity += qty;
        prod.updated_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    }

    // 2. If Cash Refund, adjust customer's total purchases and invoice status
    if !is_suit_exchange {
        if let Some(c_id) = &invoice.customer_id {
            if let Some(cust) = db.customers.iter_mut().find(|c| c.id == *c_id) {
                cust.total_purchases = (cust.total_purchases - refund_amount).max(0.0);
            }
        }
    }

    // 3. Update Invoice status
    if let Some(inv) = db.invoices.iter_mut().find(|i| i.id == invoice.id) {
        inv.status = format!("Returned ({})", if is_suit_exchange { "Exchange" } else { "Refund" });
    }

    // 4. Record the return audit log
    let return_id = format!("RET-{:04}", db.sales_returns.len() + 1);
    let sale_return = SaleReturn {
        id: return_id,
        invoice_id: invoice.id.clone(),
        customer_name: invoice.customer_name.clone(),
        product_id: item.product_id.clone(),
        product_name: item.name.clone(),
        quantity: qty,
        refund_amount,
        return_type: return_type_label.clone(),
        reason: payload.reason.unwrap_or_else(|| "کسٹمر کی طرف سے واپسی".to_string()),
        date: today,
    };

    db.sales_returns.push(sale_return.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    let msg = if is_suit_exchange {
        format!("سوٹ کا ریٹرن درج ہو گیا ہے۔ {} پیسز اسٹاک میں دوبارہ شامل کر دیے گئے ہیں۔", qty)
    } else {
        format!("رقم کی واپسی ({} روپے) مکمل ہو گئی ہے اور {} پیسز اسٹاک میں شامل کر دیے گئے ہیں۔", refund_amount, qty)
    };

    Ok(Json(ProcessReturnResponse {
        success: true,
        sale_return,
        restocked_quantity: qty,
        message: msg,
    }))
}

pub async fn list_sales_returns(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    Json(db.sales_returns.clone())
}

// ======================== Invoices ========================

pub async fn list_invoices(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut invs = db.invoices.clone();
    invs.reverse();
    Json(invs)
}

pub async fn get_invoice_by_id(
    Path(id): Path<String>,
    State(db_state): State<DbState>,
) -> Result<Json<Invoice>, StatusCode> {
    let db = db_state.read().await;
    if let Some(inv) = db.invoices.iter().find(|i| i.id == id || i.invoice_number == id) {
        Ok(Json(inv.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// ======================== Estimates / Quotations ========================

pub async fn list_estimates(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut ests = db.estimates.clone();
    ests.reverse();
    Json(ests)
}

#[derive(Deserialize)]
pub struct CreateEstimatePayload {
    pub customer_name: String,
    pub customer_phone: String,
    pub valid_until: Option<String>,
    pub items: Vec<CartItemInput>,
    pub notes: Option<String>,
}

pub async fn create_estimate(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateEstimatePayload>,
) -> Result<Json<Estimate>, (StatusCode, String)> {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let valid_until = payload.valid_until.unwrap_or_else(|| {
        (chrono::Local::now() + chrono::Duration::days(15)).format("%Y-%m-%d").to_string()
    });

    let mut items: Vec<InvoiceItem> = Vec::new();
    let mut grand_total = 0.0;

    for inp in &payload.items {
        if let Some(p) = db.products.iter().find(|p| p.id == inp.product_id) {
            let unit_price = inp.custom_price.unwrap_or(p.selling_price);
            let tot = unit_price * (inp.quantity as f64);
            let cost = p.cost_price * (inp.quantity as f64);
            grand_total += tot;

            items.push(InvoiceItem {
                product_id: p.id.clone(),
                barcode: p.barcode.clone(),
                name: p.name.clone(),
                color: p.color.clone(),
                quantity: inp.quantity,
                unit_cost: p.cost_price,
                unit_price,
                total: tot,
                profit: tot - cost,
            });
        }
    }

    let est_id = format!("EST-{:04}", db.estimates.len() + 1001);
    let estimate = Estimate {
        id: est_id.clone(),
        estimate_number: est_id,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        date: today,
        valid_until,
        items,
        grand_total,
        status: "Pending".to_string(),
        notes: payload.notes.unwrap_or_default(),
    };

    db.estimates.push(estimate.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    Ok(Json(estimate))
}

// ======================== Purchases / Suppliers ========================

pub async fn list_purchases(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut po = db.purchases.clone();
    po.reverse();
    Json(po)
}

#[derive(Deserialize)]
pub struct CreatePurchasePayload {
    pub supplier_id: String,
    pub items: Vec<PurchaseItem>,
    pub paid_amount: f64,
    pub notes: Option<String>,
}

pub async fn create_purchase(
    State(db_state): State<DbState>,
    Json(payload): Json<CreatePurchasePayload>,
) -> Result<Json<PurchaseOrder>, (StatusCode, String)> {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now_full = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let supplier_name = db.suppliers.iter().find(|s| s.id == payload.supplier_id)
        .map(|s| s.name.clone())
        .unwrap_or_else(|| "عام سپلائر".to_string());

    let mut grand_total = 0.0;
    for itm in &payload.items {
        grand_total += itm.total;
        // Increment stock in products!
        if let Some(p) = db.products.iter_mut().find(|p| p.id == itm.product_id) {
            p.stock_quantity += itm.quantity;
            p.cost_price = itm.unit_cost;
            p.updated_at = now_full.clone();
        }
    }

    let due_amount = (grand_total - payload.paid_amount).max(0.0);

    // Update supplier payable
    if let Some(s) = db.suppliers.iter_mut().find(|s| s.id == payload.supplier_id) {
        s.balance_payable += due_amount;
        s.total_purchased += grand_total;
    }

    let po_id = format!("PO-{:04}", db.purchases.len() + 1001);
    let po = PurchaseOrder {
        id: po_id.clone(),
        po_number: po_id,
        supplier_id: payload.supplier_id,
        supplier_name,
        date: today,
        items: payload.items,
        grand_total,
        paid_amount: payload.paid_amount,
        due_amount,
        status: "Received".to_string(),
        notes: payload.notes.unwrap_or_default(),
    };

    db.purchases.push(po.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    Ok(Json(po))
}

pub async fn list_suppliers(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    Json(db.suppliers.clone())
}

#[derive(Deserialize)]
pub struct CreateSupplierPayload {
    pub name: String,
    pub contact_person: String,
    pub phone: String,
    pub address: String,
    pub initial_balance: Option<f64>,
}

pub async fn create_supplier(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateSupplierPayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let id = format!("SUP-{:03}", db.suppliers.len() + 1);

    let supplier = Supplier {
        id,
        name: payload.name,
        contact_person: payload.contact_person,
        phone: payload.phone,
        address: payload.address,
        balance_payable: payload.initial_balance.unwrap_or(0.0),
        total_purchased: 0.0,
        created_at: now,
    };

    db.suppliers.push(supplier.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(supplier))
}

// ======================== Expenses ========================

pub async fn list_expenses(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut exp = db.expenses.clone();
    exp.reverse();
    Json(exp)
}

#[derive(Deserialize)]
pub struct CreateExpensePayload {
    pub category: String,
    pub amount: f64,
    pub paid_by: String,
    pub description: String,
}

pub async fn create_expense(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateExpensePayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let id = format!("EXP-{:04}", db.expenses.len() + 1001);

    let expense = Expense {
        id,
        category: payload.category,
        amount: payload.amount,
        date: today,
        paid_by: payload.paid_by,
        description: payload.description,
    };

    db.expenses.push(expense.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(expense))
}

// ======================== Delivery Notes ========================

pub async fn list_delivery_notes(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    let mut dn = db.delivery_notes.clone();
    dn.reverse();
    Json(dn)
}

#[derive(Deserialize)]
pub struct CreateDeliveryNotePayload {
    pub invoice_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub delivery_address: String,
    pub courier: String,
    pub tracking_number: String,
}

pub async fn create_delivery_note(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateDeliveryNotePayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let id = format!("DN-{:04}", db.delivery_notes.len() + 1001);

    let dn = DeliveryNote {
        id: id.clone(),
        note_number: id,
        invoice_id: payload.invoice_id,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        delivery_address: payload.delivery_address,
        courier: payload.courier,
        tracking_number: payload.tracking_number,
        status: "Dispatched".to_string(),
        date: today,
    };

    db.delivery_notes.push(dn.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(dn))
}

// ======================== Agents / Staff ========================

pub async fn list_agents(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    Json(db.agents.clone())
}

#[derive(Deserialize)]
pub struct CreateAgentPayload {
    pub name: String,
    pub role: String,
    pub phone: String,
    pub email: String,
}

pub async fn create_agent(
    State(db_state): State<DbState>,
    Json(payload): Json<CreateAgentPayload>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    let id = format!("AGT-{:03}", db.agents.len() + 1);

    let agent = StoreAgent {
        id,
        name: payload.name,
        role: payload.role,
        phone: payload.phone,
        email: payload.email,
        status: "Active".to_string(),
    };

    db.agents.push(agent.clone());
    drop(db);
    save_db_to_disk(&db_state).await;

    (StatusCode::CREATED, Json(agent))
}

// ======================== Settings ========================

pub async fn get_settings(
    State(db_state): State<DbState>,
) -> impl IntoResponse {
    let db = db_state.read().await;
    Json(db.store_settings.clone())
}

pub async fn update_settings(
    State(db_state): State<DbState>,
    Json(payload): Json<StoreSettings>,
) -> impl IntoResponse {
    let mut db = db_state.write().await;
    db.store_settings = payload.clone();
    drop(db);
    save_db_to_disk(&db_state).await;

    Json(payload)
}
