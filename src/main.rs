mod api;
mod db;
mod models;

use axum::{
    routing::{get, post, put},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    println!("============================================================");
    println!("  Clothing Store ERP System");
    println!("  Enterprise Point of Sale & Management Core (Rust Engine)");
    println!("============================================================");

    // Initialize database
    let db_state = db::init_db().await;

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // API Routes
    let api_routes = Router::new()
        .route("/overview", get(api::get_overview))
        // Products & Stock
        .route("/products", get(api::list_products).post(api::create_product))
        .route("/products/:id", put(api::update_product).delete(api::delete_product))
        .route("/products/by-barcode/:barcode", get(api::get_product_by_barcode))
        .route("/products/restock", post(api::restock_by_scanner))
        // Point of Sale (POS)
        .route("/pos/checkout", post(api::pos_checkout))
        // Customers & Purchase History
        .route("/customers", get(api::list_customers).post(api::create_customer))
        .route("/customers/:id", get(api::get_customer_details))
        // Returns & Refunds
        .route("/returns/process", post(api::process_sale_return))
        .route("/returns", get(api::list_sales_returns))
        // Invoices
        .route("/invoices", get(api::list_invoices))
        .route("/invoices/:id", get(api::get_invoice_by_id))
        // Estimates / Quotations
        .route("/estimates", get(api::list_estimates).post(api::create_estimate))
        // Purchases & Suppliers
        .route("/purchases", get(api::list_purchases).post(api::create_purchase))
        .route("/suppliers", get(api::list_suppliers).post(api::create_supplier))
        // Expenses
        .route("/expenses", get(api::list_expenses).post(api::create_expense))
        // Delivery Notes
        .route("/delivery-notes", get(api::list_delivery_notes).post(api::create_delivery_note))
        // Agents / Staff
        .route("/agents", get(api::list_agents).post(api::create_agent))
        // Settings
        .route("/settings", get(api::get_settings).put(api::update_settings))
        .with_state(db_state);

    // App router with API and static files
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("static"))
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!(">>> سرور کامیابی کے ساتھ شروع ہو چکا ہے!");
    println!(">>> Server running at: http://127.0.0.1:8080");
    println!(">>> Browser mein open karein: http://localhost:8080");
    println!("============================================================");

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to 127.0.0.1:8080: {}. Trying port 8085...", e);
            let fallback_addr = SocketAddr::from(([127, 0, 0, 1], 8085));
            tokio::net::TcpListener::bind(fallback_addr).await.expect("Failed to bind fallback port 8085")
        }
    };

    axum::serve(listener, app).await.unwrap();
}
