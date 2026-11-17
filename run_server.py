#!/usr/bin/env python3
"""
Clothing Store ERP - High-Performance Dual Core Engine
This server implements the exact same REST API & static file serving as the Rust core.
It operates directly on 'data/erp_database.json'.
"""

import os
import sys
import json
import mimetypes
from datetime import datetime, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

PORT = 8080
DB_FILE = os.path.join(os.path.dirname(__file__), "data", "erp_database.json")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public") if os.path.exists(os.path.join(os.path.dirname(__file__), "public")) else os.path.join(os.path.dirname(__file__), "static")

def ensure_db():
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    if not os.path.exists(DB_FILE):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today = datetime.now().strftime("%Y-%m-%d")
        default_db = {
            "store_settings": {
                "store_name": "Clothing Store",
                "store_name_urdu": "Clothing Store",
                "slogan": "Premium Fabrics & Apparel",
                "address": "Lahore / Gujranwala, Pakistan",
                "phone": "+92 300 0000000",
                "email": "contact@clothingstore.com",
                "tax_percentage": 0.0,
                "currency": "PKR (Rs.)",
                "invoice_footer": "Thank you for shopping at Clothing Store! Goods once sold can be exchanged within 7 days with original invoice."
            },
            "products": [],
            "customers": [],
            "suppliers": [],
            "invoices": [],
            "estimates": [],
            "purchases": [],
            "expenses": [],
            "sales_returns": [],
            "purchase_returns": [],
            "delivery_notes": [],
            "agents": [
                {
                    "id": "AGT-001",
                    "name": "Store Admin",
                    "role": "Owner / Admin",
                    "phone": "",
                    "email": "admin@clothingstore.com",
                    "status": "Active"
                }
            ]
        }
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(default_db, f, ensure_ascii=False, indent=2)

def read_db():
    ensure_db()
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class ErpHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw)
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)

        if path.startswith("/api/"):
            self.handle_api_get(path[5:], query)
        else:
            self.handle_static_file(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/api/"):
            self.handle_api_post(path[5:])
        else:
            self.send_error(404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/api/"):
            self.handle_api_put(path[5:])
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/api/"):
            self.handle_api_delete(path[5:])
        else:
            self.send_error(404)

    def handle_static_file(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        file_path = os.path.join(STATIC_DIR, path.lstrip("/"))
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404, "File not found")

    def handle_api_get(self, endpoint, query):
        db = read_db()
        current_month = datetime.now().strftime("%Y-%m")
        month_name = datetime.now().strftime("%B %Y")

        if endpoint == "overview":
            total_sales_month = 0.0
            total_profit_month = 0.0
            payment_received_month = 0.0
            product_sales = {} # id -> [units, rev, prof]

            for inv in db.get("invoices", []):
                if inv["date"].startswith(current_month):
                    total_sales_month += inv.get("grand_total", 0.0)
                    total_profit_month += inv.get("total_profit", 0.0)
                    payment_received_month += inv.get("amount_paid", 0.0)

                for item in inv.get("items", []):
                    pid = item["product_id"]
                    if pid not in product_sales:
                        product_sales[pid] = [0, 0.0, 0.0]
                    product_sales[pid][0] += item["quantity"]
                    product_sales[pid][1] += item["total"]
                    product_sales[pid][2] += item["profit"]

            total_purchases_month = 0.0
            payment_paid_suppliers = 0.0
            for po in db.get("purchases", []):
                if po["date"].startswith(current_month):
                    total_purchases_month += po.get("grand_total", 0.0)
                    payment_paid_suppliers += po.get("paid_amount", 0.0)

            total_expenses_month = 0.0
            for exp in db.get("expenses", []):
                if exp["date"].startswith(current_month):
                    total_expenses_month += exp.get("amount", 0.0)

            payment_paid_month = payment_paid_suppliers + total_expenses_month
            net_profit_month = total_profit_month - total_expenses_month

            total_stock_units = 0
            total_stock_value_cost = 0.0
            total_stock_value_retail = 0.0
            low_stock_count = 0
            out_of_stock_count = 0
            all_ranks = []

            for p in db.get("products", []):
                qty = p["stock_quantity"]
                total_stock_units += qty
                total_stock_value_cost += p["cost_price"] * qty
                total_stock_value_retail += p["selling_price"] * qty

                if qty == 0:
                    out_of_stock_count += 1
                elif qty <= p.get("min_stock_alert", 10):
                    low_stock_count += 1

                units, rev, prof = product_sales.get(p["id"], [0, 0.0, 0.0])
                all_ranks.append({
                    "id": p["id"],
                    "barcode": p["barcode"],
                    "name": p["name"],
                    "category": p["category"],
                    "current_stock": qty,
                    "units_sold": units,
                    "total_revenue": rev,
                    "total_profit": prof
                })

            best_selling = sorted(all_ranks, key=lambda x: x["units_sold"], reverse=True)[:5]
            slowest_selling = sorted(all_ranks, key=lambda x: x["units_sold"])[:5]
            recent_invoices = list(reversed(db.get("invoices", [])))[:6]

            overview = {
                "store_name": db["store_settings"]["store_name"],
                "store_name_urdu": db["store_settings"]["store_name_urdu"],
                "month_name": month_name,
                "total_sales_month": total_sales_month,
                "total_purchases_month": total_purchases_month,
                "total_profit_month": net_profit_month,
                "payment_received_month": payment_received_month,
                "payment_paid_month": payment_paid_month,
                "total_expenses_month": total_expenses_month,
                "total_stock_units": total_stock_units,
                "total_stock_value_cost": total_stock_value_cost,
                "total_stock_value_retail": total_stock_value_retail,
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "total_customers": len(db.get("customers", [])),
                "total_invoices_count": len(db.get("invoices", [])),
                "best_selling_suits": best_selling,
                "slowest_selling_suits": slowest_selling,
                "recent_invoices": recent_invoices
            }
            self.send_json(overview)

        elif endpoint == "products":
            prods = db.get("products", [])
            search = query.get("search", [None])[0]
            cat = query.get("category", [None])[0]
            low_stock = query.get("low_stock", [None])[0]

            if search:
                s = search.lower()
                prods = [p for p in prods if s in p["name"].lower() or s in p["barcode"].lower() or s in p["color"].lower()]
            if cat and cat != "All":
                prods = [p for p in prods if p["category"] == cat]
            if low_stock == "true":
                prods = [p for p in prods if p["stock_quantity"] <= p.get("min_stock_alert", 10)]

            self.send_json(prods)

        elif endpoint.startswith("products/by-barcode/"):
            barcode = endpoint.split("/")[-1].strip().lower()
            for p in db.get("products", []):
                if p["barcode"].lower() == barcode or p["id"].lower() == barcode:
                    return self.send_json(p)
            self.send_error(404, "Product not found")

        elif endpoint == "customers":
            self.send_json(db.get("customers", []))

        elif endpoint.startswith("customers/"):
            cust_id = endpoint.split("/")[-1].strip().lower()
            target_cust = None
            for c in db.get("customers", []):
                if c["id"].lower() == cust_id or c["phone"].lower() == cust_id or cust_id in c["name"].lower():
                    target_cust = c
                    break

            if not target_cust:
                return self.send_error(404, "Customer not found")

            history = []
            cust_invoices = []
            for inv in db.get("invoices", []):
                is_match = (inv.get("customer_id") == target_cust["id"] or 
                            inv.get("customer_phone") == target_cust["phone"] or
                            target_cust["name"].lower() in inv.get("customer_name", "").lower())
                if is_match:
                    cust_invoices.append(inv)
                    for item in inv.get("items", []):
                        history.append({
                            "invoice_id": inv["id"],
                            "invoice_number": inv["invoice_number"],
                            "date": inv["date"],
                            "product_id": item["product_id"],
                            "product_name": item["name"],
                            "barcode": item["barcode"],
                            "color": item.get("color", ""),
                            "quantity": item["quantity"],
                            "unit_price": item["unit_price"],
                            "total": item["total"]
                        })

            self.send_json({
                "customer": target_cust,
                "purchase_history": history,
                "invoices": cust_invoices
            })

        elif endpoint == "invoices":
            self.send_json(list(reversed(db.get("invoices", []))))

        elif endpoint.startswith("invoices/"):
            inv_id = endpoint.split("/")[-1].strip()
            for inv in db.get("invoices", []):
                if inv["id"] == inv_id or inv["invoice_number"] == inv_id:
                    return self.send_json(inv)
            self.send_error(404, "Invoice not found")

        elif endpoint == "returns":
            self.send_json(list(reversed(db.get("sales_returns", []))))

        elif endpoint == "estimates":
            self.send_json(list(reversed(db.get("estimates", []))))

        elif endpoint == "purchases":
            self.send_json(list(reversed(db.get("purchases", []))))

        elif endpoint == "suppliers":
            self.send_json(db.get("suppliers", []))

        elif endpoint == "expenses":
            self.send_json(list(reversed(db.get("expenses", []))))

        elif endpoint == "delivery-notes":
            self.send_json(list(reversed(db.get("delivery_notes", []))))

        elif endpoint == "agents":
            self.send_json(db.get("agents", []))

        elif endpoint == "settings":
            self.send_json(db.get("store_settings", {}))

        else:
            self.send_error(404, "API endpoint not found")

    def handle_api_post(self, endpoint):
        db = read_db()
        payload = self.read_json_body()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today = datetime.now().strftime("%Y-%m-%d")

        if endpoint == "pos/checkout":
            items_input = payload.get("items", [])
            if not items_input:
                return self.send_json({"error": "No products added in the bill cart."}, status=400)

            # Stock check
            prod_map = {p["id"]: p for p in db.get("products", [])}
            for inp in items_input:
                pid = inp["product_id"]
                if pid not in prod_map:
                    return self.send_json({"error": f"Product ID {pid} not found"}, status=400)
                if prod_map[pid]["stock_quantity"] < inp["quantity"]:
                    return self.send_json({"error": f"Insufficient stock for suit '{prod_map[pid]['name']}'. Available: {prod_map[pid]['stock_quantity']} pieces."}, status=400)

            # Deduct stock and compute
            invoice_items = []
            subtotal = 0.0
            total_cost = 0.0

            for inp in items_input:
                p = prod_map[inp["product_id"]]
                qty = inp["quantity"]
                p["stock_quantity"] -= qty
                p["updated_at"] = now

                unit_price = inp.get("custom_price") or p["selling_price"]
                item_total = unit_price * qty
                item_cost = p["cost_price"] * qty
                item_profit = item_total - item_cost

                subtotal += item_total
                total_cost += item_cost

                invoice_items.append({
                    "product_id": p["id"],
                    "barcode": p["barcode"],
                    "name": p["name"],
                    "color": p["color"],
                    "quantity": qty,
                    "unit_cost": p["cost_price"],
                    "unit_price": unit_price,
                    "total": item_total,
                    "profit": item_profit
                })

            discount = payload.get("discount", 0.0)
            grand_total = max(0.0, subtotal - discount)
            total_profit = max(0.0, grand_total - total_cost)
            amount_paid = payload.get("amount_paid", grand_total)
            change_due = max(0.0, amount_paid - grand_total)

            cust_name = payload.get("customer_name", "Walk-in Customer").strip()
            cust_phone = payload.get("customer_phone", "").strip()

            cust_id = None
            if cust_phone:
                found_cust = None
                for c in db.get("customers", []):
                    if c["phone"] == cust_phone or (cust_name and c["name"].lower() == cust_name.lower()):
                        found_cust = c
                        break
                if found_cust:
                    found_cust["total_purchases"] += grand_total
                    found_cust["total_orders"] += 1
                    cust_id = found_cust["id"]
                else:
                    new_cid = f"CUST-{len(db.get('customers', [])) + 1:03d}"
                    db.setdefault("customers", []).append({
                        "id": new_cid,
                        "name": cust_name,
                        "phone": cust_phone,
                        "address": payload.get("customer_city", "Lahore"),
                        "city": payload.get("customer_city", "Lahore"),
                        "total_purchases": grand_total,
                        "total_orders": 1,
                        "created_at": now
                    })
                    cust_id = new_cid

            inv_count = len(db.get("invoices", [])) + 1001
            inv_id = f"INV-{inv_count}"
            inv_num = f"INV-{inv_count:04d}"

            invoice = {
                "id": inv_id,
                "invoice_number": inv_num,
                "customer_id": cust_id,
                "customer_name": cust_name,
                "customer_phone": cust_phone,
                "date": today,
                "items": invoice_items,
                "subtotal": subtotal,
                "discount": discount,
                "tax": 0.0,
                "grand_total": grand_total,
                "total_cost": total_cost,
                "total_profit": total_profit,
                "payment_method": payload.get("payment_method", "Cash"),
                "amount_paid": amount_paid,
                "change_due": change_due,
                "status": "Paid",
                "notes": payload.get("notes", "")
            }

            db.setdefault("invoices", []).append(invoice)
            write_db(db)

            self.send_json({
                "success": True,
                "invoice": invoice,
                "message": "Sale completed successfully! Stock deducted in real time."
            })

        elif endpoint == "products/restock":
            barcode = payload.get("barcode", "").strip().lower()
            qty = max(1, int(payload.get("quantity_to_add", 1)))
            found = None
            for p in db.get("products", []):
                if p["barcode"].lower() == barcode or p["id"].lower() == barcode:
                    p["stock_quantity"] += qty
                    p["updated_at"] = now
                    found = p
                    break

            if found:
                write_db(db)
                self.send_json({
                    "success": True,
                    "product": found,
                    "added_quantity": qty,
                    "new_total_stock": found["stock_quantity"],
                    "message": f"Stock increased by {qty} pieces! Total stock is now: {found['stock_quantity']}"
                })
            else:
                self.send_json({"error": f"Barcode '{barcode}' not found"}, status=404)

        elif endpoint == "returns/process":
            inv_id = payload.get("invoice_id")
            pid = payload.get("product_id")
            qty = max(1, int(payload.get("quantity", 1)))
            ret_type = payload.get("return_type", "SUIT_EXCHANGE")
            reason = payload.get("reason", "Customer return or exchange")
            exchange_pid = payload.get("exchange_product_id")
            exchange_qty = max(1, int(payload.get("exchange_quantity", 1)))
            payment_method = payload.get("payment_method", "Cash")

            invoice = None
            for inv in db.get("invoices", []):
                if inv["id"] == inv_id or inv["invoice_number"] == inv_id:
                    invoice = inv
                    break

            if not invoice:
                return self.send_json({"error": "Invoice not found"}, status=404)

            item = None
            for itm in invoice.get("items", []):
                if itm["product_id"] == pid:
                    item = itm
                    break

            if not item:
                return self.send_json({"error": "Suit was not found in this invoice"}, status=404)

            qty = min(qty, item["quantity"])
            refund_amount = item["unit_price"] * qty
            is_suit_exchange = "EXCHANGE" in ret_type.upper()

            # 1. Restock returned suit into inventory
            for p in db.get("products", []):
                if p["id"] == pid:
                    p["stock_quantity"] += qty
                    p["updated_at"] = now
                    break

            exchange_item = None
            exchange_total = 0.0
            net_difference = -refund_amount

            # 2. If exchange item chosen, deduct its stock and compute difference
            if is_suit_exchange and exchange_pid:
                new_prod = None
                for p in db.get("products", []):
                    if p["id"] == exchange_pid:
                        new_prod = p
                        break

                if not new_prod:
                    return self.send_json({"error": "Newly selected exchange suit was not found"}, status=404)
                if new_prod["stock_quantity"] < exchange_qty:
                    return self.send_json({"error": f"Insufficient stock for '{new_prod['name']}'. Available: {new_prod['stock_quantity']} pcs"}, status=400)

                new_prod["stock_quantity"] -= exchange_qty
                new_prod["updated_at"] = now
                exchange_total = new_prod["selling_price"] * exchange_qty
                net_difference = exchange_total - refund_amount

                exchange_item = {
                    "product_id": new_prod["id"],
                    "barcode": new_prod["barcode"],
                    "name": new_prod["name"],
                    "color": new_prod.get("color", ""),
                    "quantity": exchange_qty,
                    "unit_price": new_prod["selling_price"],
                    "total": exchange_total
                }

            # Update customer ledger
            if invoice.get("customer_id"):
                for c in db.get("customers", []):
                    if c["id"] == invoice["customer_id"]:
                        c["total_purchases"] = max(0.0, c["total_purchases"] + net_difference)
                        break

            ret_num = len(db.get("sales_returns", [])) + 1
            ret_id = f"EXC-{ret_num:04d}" if (is_suit_exchange and exchange_item) else f"RET-{ret_num:04d}"

            sale_ret = {
                "id": ret_id,
                "invoice_id": invoice["id"],
                "invoice_number": invoice["invoice_number"],
                "customer_name": invoice["customer_name"],
                "customer_phone": invoice.get("customer_phone", ""),
                "product_id": pid,
                "product_name": item["name"],
                "color": item.get("color", ""),
                "quantity": qty,
                "unit_price": item["unit_price"],
                "refund_amount": refund_amount,
                "return_type": "Return & Exchange" if (is_suit_exchange and exchange_item) else ("Suit Restock / Exchange" if is_suit_exchange else "Cash / Payment Refund"),
                "reason": reason,
                "date": today,
                "created_at": now,
                "exchange_item": exchange_item,
                "returned_credit": refund_amount,
                "new_item_total": exchange_total,
                "net_difference": net_difference,
                "payment_method": payment_method
            }

            db.setdefault("sales_returns", []).append(sale_ret)
            invoice["status"] = f"Exchanged ({ret_id})" if (is_suit_exchange and exchange_item) else f"Returned ({ret_id})"
            write_db(db)

            if is_suit_exchange and exchange_item:
                if net_difference > 0:
                    msg = f"Exchange processed! Customer paid difference of Rs. {net_difference:,.0f} via {payment_method}."
                elif net_difference < 0:
                    msg = f"Exchange processed! Store refunded difference of Rs. {abs(net_difference):,.0f} to customer."
                else:
                    msg = "Even exchange processed! New suit provided at identical value (Rs. 0 difference)."
            else:
                msg = f"Return processed! {qty} piece(s) restocked into inventory. Cash refund: Rs. {refund_amount:,.0f}."

            self.send_json({
                "success": True,
                "sale_return": sale_ret,
                "exchange_slip": sale_ret,
                "message": msg
            })

        elif endpoint == "products":
            count = len(db.get("products", [])) + 1001
            pid = f"PRD-{count}"
            barcode = payload.get("barcode") or f"890{count:04d}"

            new_prod = {
                "id": pid,
                "barcode": barcode,
                "name": payload["name"],
                "category": payload.get("category", "Unstitched Fabric"),
                "fabric": payload.get("fabric", "Wash & Wear"),
                "color": payload.get("color", "Black"),
                "size": payload.get("size", "4.5 Meters"),
                "cost_price": float(payload["cost_price"]),
                "selling_price": float(payload["selling_price"]),
                "stock_quantity": int(payload["stock_quantity"]),
                "min_stock_alert": int(payload.get("min_stock_alert", 10)),
                "supplier_id": payload.get("supplier_id"),
                "description": payload.get("description", ""),
                "created_at": now,
                "updated_at": now
            }
            db.setdefault("products", []).append(new_prod)
            write_db(db)
            self.send_json(new_prod, status=201)

        elif endpoint == "customers":
            new_cid = f"CUST-{len(db.get('customers', [])) + 1:03d}"
            new_cust = {
                "id": new_cid,
                "name": payload["name"],
                "phone": payload["phone"],
                "address": payload.get("address", ""),
                "city": payload.get("city", "Lahore"),
                "total_purchases": 0.0,
                "total_orders": 0,
                "created_at": now
            }
            db.setdefault("customers", []).append(new_cust)
            write_db(db)
            self.send_json(new_cust, status=201)

        elif endpoint == "suppliers":
            sid = f"SUP-{len(db.get('suppliers', [])) + 1:03d}"
            new_sup = {
                "id": sid,
                "name": payload["name"],
                "contact_person": payload.get("contact_person", ""),
                "phone": payload.get("phone", ""),
                "address": payload.get("address", ""),
                "balance_payable": float(payload.get("initial_balance", 0.0)),
                "total_purchased": 0.0,
                "created_at": now
            }
            db.setdefault("suppliers", []).append(new_sup)
            write_db(db)
            self.send_json(new_sup, status=201)

        elif endpoint == "purchases":
            po_id = f"PO-{len(db.get('purchases', [])) + 1001:04d}"
            sup_name = "General Supplier"
            for s in db.get("suppliers", []):
                if s["id"] == payload.get("supplier_id"):
                    sup_name = s["name"]
                    break

            grand_total = 0.0
            for itm in payload.get("items", []):
                grand_total += itm.get("total", 0.0)
                # Restock product
                for p in db.get("products", []):
                    if p["id"] == itm["product_id"]:
                        p["stock_quantity"] += itm["quantity"]
                        p["cost_price"] = itm["unit_cost"]
                        p["updated_at"] = now
                        break

            paid = float(payload.get("paid_amount", 0.0))
            due = max(0.0, grand_total - paid)

            for s in db.get("suppliers", []):
                if s["id"] == payload.get("supplier_id"):
                    s["balance_payable"] += due
                    s["total_purchased"] += grand_total
                    break

            po = {
                "id": po_id,
                "po_number": po_id,
                "supplier_id": payload.get("supplier_id"),
                "supplier_name": sup_name,
                "date": today,
                "items": payload.get("items", []),
                "grand_total": grand_total,
                "paid_amount": paid,
                "due_amount": due,
                "status": "Received",
                "notes": payload.get("notes", "")
            }
            db.setdefault("purchases", []).append(po)
            write_db(db)
            self.send_json(po, status=201)

        elif endpoint == "expenses":
            eid = f"EXP-{len(db.get('expenses', [])) + 1001:04d}"
            exp = {
                "id": eid,
                "category": payload.get("category", "Packaging"),
                "amount": float(payload.get("amount", 0.0)),
                "date": today,
                "paid_by": payload.get("paid_by", "Cash Counter"),
                "description": payload.get("description", "")
            }
            db.setdefault("expenses", []).append(exp)
            write_db(db)
            self.send_json(exp, status=201)

        elif endpoint == "estimates":
            est_id = f"EST-{len(db.get('estimates', [])) + 1001:04d}"
            prod_map = {p["id"]: p for p in db.get("products", [])}
            items = []
            grand_total = 0.0
            for itm in payload.get("items", []):
                p = prod_map.get(itm["product_id"])
                if p:
                    tot = p["selling_price"] * itm["quantity"]
                    grand_total += tot
                    items.append({
                        "product_id": p["id"],
                        "barcode": p["barcode"],
                        "name": p["name"],
                        "color": p["color"],
                        "quantity": itm["quantity"],
                        "unit_cost": p["cost_price"],
                        "unit_price": p["selling_price"],
                        "total": tot,
                        "profit": tot - (p["cost_price"] * itm["quantity"])
                    })

            est = {
                "id": est_id,
                "estimate_number": est_id,
                "customer_name": payload.get("customer_name"),
                "customer_phone": payload.get("customer_phone"),
                "date": today,
                "valid_until": payload.get("valid_until", (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")),
                "items": items,
                "grand_total": grand_total,
                "status": "Pending",
                "notes": payload.get("notes", "")
            }
            db.setdefault("estimates", []).append(est)
            write_db(db)
            self.send_json(est, status=201)

        elif endpoint == "delivery-notes":
            dn_id = f"DN-{len(db.get('delivery_notes', [])) + 1001:04d}"
            dn = {
                "id": dn_id,
                "note_number": dn_id,
                "invoice_id": payload.get("invoice_id"),
                "customer_name": payload.get("customer_name"),
                "customer_phone": payload.get("customer_phone"),
                "delivery_address": payload.get("delivery_address"),
                "courier": payload.get("courier", "TCS"),
                "tracking_number": payload.get("tracking_number"),
                "status": "Dispatched",
                "date": today
            }
            db.setdefault("delivery_notes", []).append(dn)
            write_db(db)
            self.send_json(dn, status=201)

        else:
            self.send_error(404)

    def handle_api_put(self, endpoint):
        db = read_db()
        payload = self.read_json_body()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if endpoint.startswith("products/"):
            pid = endpoint.split("/")[-1].strip()
            for p in db.get("products", []):
                if p["id"] == pid:
                    p.update(payload)
                    p["updated_at"] = now
                    write_db(db)
                    return self.send_json(p)
            self.send_error(404, "Product not found")

        elif endpoint == "settings":
            db["store_settings"] = payload
            write_db(db)
            self.send_json(payload)

        else:
            self.send_error(404)

    def handle_api_delete(self, endpoint):
        db = read_db()
        if endpoint.startswith("products/"):
            pid = endpoint.split("/")[-1].strip()
            db["products"] = [p for p in db.get("products", []) if p["id"] != pid]
            write_db(db)
            self.send_response(204)
            self.end_headers()
        elif endpoint.startswith("suppliers/"):
            sid = endpoint.split("/")[-1].strip()
            db["suppliers"] = [s for s in db.get("suppliers", []) if s["id"] != sid]
            write_db(db)
            self.send_response(204)
            self.end_headers()
        elif endpoint.startswith("expenses/"):
            eid = endpoint.split("/")[-1].strip()
            db["expenses"] = [e for e in db.get("expenses", []) if e["id"] != eid]
            write_db(db)
            self.send_response(204)
            self.end_headers()
        elif endpoint.startswith("customers/"):
            cid = endpoint.split("/")[-1].strip()
            db["customers"] = [c for c in db.get("customers", []) if c["id"] != cid]
            write_db(db)
            self.send_response(204)
            self.end_headers()
        else:
            self.send_error(404)

def run():
    ensure_db()
    server_address = ("127.0.0.1", PORT)
    httpd = ThreadingHTTPServer(server_address, ErpHandler)
    print("=" * 60)
    print("  Clothing Store ERP Server Live")
    print("  Enterprise Fast REST API & Web Engine")
    print(f">>> Server URL: http://localhost:{PORT}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        httpd.server_close()

if __name__ == "__main__":
    run()
