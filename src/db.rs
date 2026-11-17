use std::path::Path;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use crate::models::*;

pub type DbState = Arc<RwLock<ErpDatabase>>;

const DB_PATH: &str = "data/erp_database.json";

pub async fn init_db() -> DbState {
    if !Path::new("data").exists() {
        let _ = fs::create_dir_all("data").await;
    }

    let db = if Path::new(DB_PATH).exists() {
        match fs::read_to_string(DB_PATH).await {
            Ok(content) => match serde_json::from_str::<ErpDatabase>(&content) {
                Ok(loaded) => loaded,
                Err(err) => {
                    eprintln!("Warning: Failed to parse erp_database.json: {}. Creating default db.", err);
                    create_default_db()
                }
            },
            Err(_) => create_default_db(),
        }
    } else {
        create_default_db()
    };

    let state = Arc::new(RwLock::new(db));
    save_db_to_disk(&state).await;
    state
}

pub async fn save_db_to_disk(state: &DbState) {
    let db = state.read().await;
    if let Ok(json) = serde_json::to_string_pretty(&*db) {
        let _ = fs::write(DB_PATH, json).await;
    }
}

fn create_default_db() -> ErpDatabase {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    ErpDatabase {
        store_settings: StoreSettings {
            store_name: "Clothing Store".to_string(),
            store_name_urdu: "Clothing Store".to_string(),
            slogan: "Premium Fabrics & Apparel".to_string(),
            address: "Lahore / Gujranwala, Pakistan".to_string(),
            phone: "+92 300 0000000".to_string(),
            email: "contact@clothingstore.com".to_string(),
            tax_percentage: 0.0,
            currency: "PKR (Rs.)".to_string(),
            invoice_footer: "ہماری دکان کا انتخاب کرنے کا شکریہ! فروخت شدہ مال 7 یوم کے اندر بل کے ہمراہ تبدیل یا واپس ہو سکتا ہے۔".to_string(),
        },
        products: vec![
            Product {
                id: "PRD-1001".to_string(),
                barcode: "8901001".to_string(),
                name: "بلیکش پریمیم سوٹ (Blackish Suit)".to_string(),
                category: "Unstitched Fabric".to_string(),
                fabric: "Executive Wash & Wear".to_string(),
                color: "Blackish Jet Black".to_string(),
                size: "4.5 Meters (Standard Cut)".to_string(),
                cost_price: 2500.0,
                selling_price: 4200.0,
                stock_quantity: 100,
                min_stock_alert: 15,
                supplier_id: Some("SUP-001".to_string()),
                description: "جیٹ بلیک پریمیم واش اینڈ ویئر، شکن فری، نرم اور پائیدار فیبرک۔ خصوصی مانگ پر دستیاب۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Product {
                id: "PRD-1002".to_string(),
                barcode: "8901002".to_string(),
                name: "شاہی بوسکی سوٹ (Royal Boski Silk)".to_string(),
                category: "Unstitched Fabric".to_string(),
                fabric: "Pure Boski Weight 10 Lbs".to_string(),
                color: "Traditional Cream / Off-White".to_string(),
                size: "4.5 Meters".to_string(),
                cost_price: 4000.0,
                selling_price: 6500.0,
                stock_quantity: 85,
                min_stock_alert: 10,
                supplier_id: Some("SUP-002".to_string()),
                description: "روایتی شاہی بوسکی، قدرتی چمک اور انتہائی نرم فال۔ خصوصی تقریبات اور عید کلیکشن کے لیے۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Product {
                id: "PRD-1003".to_string(),
                barcode: "8901003".to_string(),
                name: "ایجپشین لٹھا کاٹن (Egyptian Cotton Latha)".to_string(),
                category: "Unstitched Fabric".to_string(),
                fabric: "100% Egyptian Giza Cotton".to_string(),
                color: "Brilliant White".to_string(),
                size: "4.5 Meters".to_string(),
                cost_price: 2200.0,
                selling_price: 3600.0,
                stock_quantity: 90,
                min_stock_alert: 12,
                supplier_id: Some("SUP-001".to_string()),
                description: "خالص مصری روئی سے تیار کردہ ٹھنڈا اور پرسکون لٹھا، خاص گرمیوں کے لیے۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Product {
                id: "PRD-1004".to_string(),
                barcode: "8901004".to_string(),
                name: "پریمیم کرنڈی فیبرک (Winter Karandi)".to_string(),
                category: "Winter Collection".to_string(),
                fabric: "Handwoven Textured Karandi".to_string(),
                color: "Charcoal Gray".to_string(),
                size: "4.5 Meters".to_string(),
                cost_price: 3200.0,
                selling_price: 5200.0,
                stock_quantity: 45,
                min_stock_alert: 10,
                supplier_id: Some("SUP-003".to_string()),
                description: "سردیوں کا نفاست سے بھرا کرنڈی سوٹ، گرم اور باوقار وضع قطع۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Product {
                id: "PRD-1005".to_string(),
                barcode: "8901005".to_string(),
                name: "ریڈی میڈ ڈیزائنر کرتا پاجامہ (Embroidered Kurta)".to_string(),
                category: "Ready-to-Wear".to_string(),
                fabric: "Blended Linen".to_string(),
                color: "Navy Blue".to_string(),
                size: "Large (42 Chest)".to_string(),
                cost_price: 2600.0,
                selling_price: 4500.0,
                stock_quantity: 8, // Low stock sample
                min_stock_alert: 10,
                supplier_id: Some("SUP-002".to_string()),
                description: "نفیس تھریڈ کڑھائی والا کرتا مع پاجامہ، فینسی بین اور کف بٹن۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Product {
                id: "PRD-1006".to_string(),
                barcode: "8901006".to_string(),
                name: "کشمیری اون شال (Kashmiri Wool Shawl)".to_string(),
                category: "Accessories".to_string(),
                fabric: "Pure Lambswool".to_string(),
                color: "Walnut Brown".to_string(),
                size: "2.5 x 1.25 Yards".to_string(),
                cost_price: 3500.0,
                selling_price: 6000.0,
                stock_quantity: 0, // Out of stock sample
                min_stock_alert: 5,
                supplier_id: Some("SUP-003".to_string()),
                description: "خالص اون کی گرم شال، باوقار ڈیزائن اور کشمیری بارڈر۔".to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
        ],
        customers: vec![
            Customer {
                id: "CUST-001".to_string(),
                name: "محمد ارسلان (Arslan)".to_string(),
                phone: "03001234567".to_string(),
                address: "ماڈل ٹاؤن، گوجرانوالہ".to_string(),
                city: "گوجرانوالہ".to_string(),
                total_purchases: 8400.0,
                total_orders: 2,
                created_at: now.clone(),
            },
            Customer {
                id: "CUST-002".to_string(),
                name: "چوہدری کامران اختر".to_string(),
                phone: "03219876543".to_string(),
                address: "ڈیفنس فیز 5، لاہور".to_string(),
                city: "لاہور".to_string(),
                total_purchases: 13000.0,
                total_orders: 2,
                created_at: now.clone(),
            },
            Customer {
                id: "CUST-003".to_string(),
                name: "حاجی طارق محمود".to_string(),
                phone: "03335551234".to_string(),
                address: "سیٹلائٹ ٹاؤن، راولپنڈی".to_string(),
                city: "راولپنڈی".to_string(),
                total_purchases: 5200.0,
                total_orders: 1,
                created_at: now.clone(),
            },
        ],
        suppliers: vec![
            Supplier {
                id: "SUP-001".to_string(),
                name: "الرحیم ٹیکسٹائلز ملتان".to_string(),
                contact_person: "شیخ عبد الرحیم".to_string(),
                phone: "0301-4455667".to_string(),
                address: "صنعتی ایریا، فیز 2، ملتان".to_string(),
                balance_payable: 35000.0,
                total_purchased: 250000.0,
                created_at: now.clone(),
            },
            Supplier {
                id: "SUP-002".to_string(),
                name: "شاہ بوسکی ہاؤس فیصل آباد".to_string(),
                contact_person: "میاں زاہد شاہ".to_string(),
                phone: "0312-7788990".to_string(),
                address: "کپڑا مارکیٹ، ریل بازار، فیصل آباد".to_string(),
                balance_payable: 20000.0,
                total_purchased: 340000.0,
                created_at: now.clone(),
            },
            Supplier {
                id: "SUP-003".to_string(),
                name: "کوہسار وولن و کرنڈی ہب سوات".to_string(),
                contact_person: "خان گل".to_string(),
                phone: "0345-9988776".to_string(),
                address: "مین بازار مینگورہ، سوات".to_string(),
                balance_payable: 15000.0,
                total_purchased: 180000.0,
                created_at: now.clone(),
            },
        ],
        invoices: vec![
            Invoice {
                id: "INV-1001".to_string(),
                invoice_number: "INV-2026-0001".to_string(),
                customer_id: Some("CUST-001".to_string()),
                customer_name: "محمد ارسلان (Arslan)".to_string(),
                customer_phone: "03001234567".to_string(),
                date: today.clone(),
                items: vec![
                    InvoiceItem {
                        product_id: "PRD-1001".to_string(),
                        barcode: "8901001".to_string(),
                        name: "بلیکش پریمیم سوٹ (Blackish Suit)".to_string(),
                        color: "Blackish Jet Black".to_string(),
                        quantity: 2,
                        unit_cost: 2500.0,
                        unit_price: 4200.0,
                        total: 8400.0,
                        profit: 3400.0,
                    }
                ],
                subtotal: 8400.0,
                discount: 0.0,
                tax: 0.0,
                grand_total: 8400.0,
                total_cost: 5000.0,
                total_profit: 3400.0,
                payment_method: "Cash".to_string(),
                amount_paid: 8400.0,
                change_due: 0.0,
                status: "Paid".to_string(),
                notes: "محمد ارسلان نے 2 بلیکش سوٹ خریدے۔".to_string(),
            },
            Invoice {
                id: "INV-1002".to_string(),
                invoice_number: "INV-2026-0002".to_string(),
                customer_id: Some("CUST-002".to_string()),
                customer_name: "چوہدری کامران اختر".to_string(),
                customer_phone: "03219876543".to_string(),
                date: today.clone(),
                items: vec![
                    InvoiceItem {
                        product_id: "PRD-1002".to_string(),
                        barcode: "8901002".to_string(),
                        name: "شاہی بوسکی سوٹ (Royal Boski Silk)".to_string(),
                        color: "Traditional Cream".to_string(),
                        quantity: 2,
                        unit_cost: 4000.0,
                        unit_price: 6500.0,
                        total: 13000.0,
                        profit: 5000.0,
                    }
                ],
                subtotal: 13000.0,
                discount: 500.0,
                tax: 0.0,
                grand_total: 12500.0,
                total_cost: 8000.0,
                total_profit: 4500.0,
                payment_method: "Card".to_string(),
                amount_paid: 12500.0,
                change_due: 0.0,
                status: "Paid".to_string(),
                notes: "کارڈ کے ذریعے ادائیگی، اسپیشل ڈسکاؤنٹ 500 روپے".to_string(),
            },
        ],
        estimates: vec![
            Estimate {
                id: "EST-1001".to_string(),
                estimate_number: "EST-2026-0001".to_string(),
                customer_name: "سردار احمد خان".to_string(),
                customer_phone: "0302-7771122".to_string(),
                date: today.clone(),
                valid_until: "2026-12-01".to_string(),
                items: vec![
                    InvoiceItem {
                        product_id: "PRD-1001".to_string(),
                        barcode: "8901001".to_string(),
                        name: "بلیکش پریمیم سوٹ (Blackish Suit)".to_string(),
                        color: "Blackish Jet Black".to_string(),
                        quantity: 5,
                        unit_cost: 2500.0,
                        unit_price: 4200.0,
                        total: 21000.0,
                        profit: 8500.0,
                    }
                ],
                grand_total: 21000.0,
                status: "Pending".to_string(),
                notes: "شادی کی تقریبات کے لیے 5 بلیکش سوٹس کا تخمینہ".to_string(),
            }
        ],
        purchases: vec![
            PurchaseOrder {
                id: "PO-1001".to_string(),
                po_number: "PO-2026-0001".to_string(),
                supplier_id: "SUP-001".to_string(),
                supplier_name: "الرحیم ٹیکسٹائلز ملتان".to_string(),
                date: today.clone(),
                items: vec![
                    PurchaseItem {
                        product_id: "PRD-1001".to_string(),
                        name: "بلیکش پریمیم واش اینڈ ویئر تھان (100 سوٹس)".to_string(),
                        quantity: 100,
                        unit_cost: 2500.0,
                        total: 250000.0,
                    }
                ],
                grand_total: 250000.0,
                paid_amount: 215000.0,
                due_amount: 35000.0,
                status: "Received".to_string(),
                notes: "100 بلیکش سوٹس سٹاک میں شامل کیے گئے، بقایا رقم 35,000 روپے".to_string(),
            }
        ],
        expenses: vec![
            Expense {
                id: "EXP-1001".to_string(),
                category: "Rent".to_string(),
                amount: 60000.0,
                date: today.clone(),
                paid_by: "حمود سمد (Owner)".to_string(),
                description: "دکان کا ماہانہ کرایہ برائے مین مارکیٹ".to_string(),
            },
            Expense {
                id: "EXP-1002".to_string(),
                category: "Electricity".to_string(),
                amount: 18500.0,
                date: today.clone(),
                paid_by: "کیش کاؤنٹر".to_string(),
                description: "لیسکو بجلی کا کمرشل بل".to_string(),
            },
            Expense {
                id: "EXP-1003".to_string(),
                category: "Packaging".to_string(),
                amount: 8000.0,
                date: today.clone(),
                paid_by: "کیش کاؤنٹر".to_string(),
                description: "برانڈڈ بیگز اور سوٹ کور باکسز کی خریداری".to_string(),
            },
            Expense {
                id: "EXP-1004".to_string(),
                category: "Refreshment".to_string(),
                amount: 3200.0,
                date: today.clone(),
                paid_by: "سیلز سٹاف".to_string(),
                description: "کسٹمرز اور سٹاف کے لیے چائے و پانی".to_string(),
            },
        ],
        sales_returns: vec![],
        purchase_returns: vec![],
        delivery_notes: vec![
            DeliveryNote {
                id: "DN-1001".to_string(),
                note_number: "DN-2026-0001".to_string(),
                invoice_id: "INV-1002".to_string(),
                customer_name: "چوہدری کامران اختر".to_string(),
                customer_phone: "03219876543".to_string(),
                delivery_address: "ڈیفنس فیز 5، لاہور".to_string(),
                courier: "ٹی سی ایس (TCS Express)".to_string(),
                tracking_number: "TCS-99214488".to_string(),
                status: "In Transit".to_string(),
                date: today.clone(),
            }
        ],
        agents: vec![
            StoreAgent {
                id: "AGT-001".to_string(),
                name: "حمود سمد (مالک و ڈائریکٹر)".to_string(),
                role: "Admin / Owner".to_string(),
                phone: "0300-7654321".to_string(),
                email: "hamood@clothingstore.com".to_string(),
                status: "Active".to_string(),
            },
            StoreAgent {
                id: "AGT-002".to_string(),
                name: "محمد بلال (سینئر کیشئیر)".to_string(),
                role: "Cashier".to_string(),
                phone: "0311-2233445".to_string(),
                email: "bilal.pos@clothingstore.com".to_string(),
                status: "Active".to_string(),
            },
            StoreAgent {
                id: "AGT-003".to_string(),
                name: "عثمان علی (انوینٹری و سیلز ایجنٹ)".to_string(),
                role: "Sales Agent".to_string(),
                phone: "0322-8877665".to_string(),
                email: "usman.sales@clothingstore.com".to_string(),
                status: "Active".to_string(),
            },
        ],
    }
}
