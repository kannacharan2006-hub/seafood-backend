# Seafood ERP API Documentation

Complete API reference for the Seafood Enterprise Resource Planning System.

## Base URL

```
Development: http://localhost:5000
Production:  http://172.22.42.235:5000
```

## Authentication

Most endpoints require JWT token authentication.

```
Authorization: Bearer <your_jwt_token>
```

---

## Table of Contents

1. [Auth](#auth)
2. [Users](#users)
3. [Customers](#customers)
4. [Vendors](#vendors)
5. [Categories](#categories)
6. [Items](#items)
7. [Variants](#variants)
8. [Purchases](#purchases)
9. [Exports](#exports)
10. [Conversions](#conversions)
11. [Stocks](#stocks)
12. [Payments](#payments)
13. [Dashboard](#dashboard)
14. [Reports](#reports)
15. [Purchase History](#purchase-history)

---

## Auth

### POST /api/auth/login

Login to get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "OWNER",
    "company_id": 1
  }
}
```

---

### POST /api/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset email sent"
}
```

---

### POST /api/auth/register-company

Register new company with owner account.

**Request:**
```json
{
  "company_name": "Ocean Fresh Seafood",
  "owner_name": "John Doe",
  "email": "owner@example.com",
  "password": "password123",
  "phone": "+91 9876543210"
}
```

**Response (201):**
```json
{
  "message": "Company registered successfully"
}
```

---

### POST /api/auth/users

Register new user under company (Owner only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Employee Name",
  "email": "employee@example.com",
  "password": "password123",
  "role": "EMPLOYEE",
  "phone": "+91 9876543210"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully"
}
```

---

## Users

### GET /api/users

Get all users in company.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "OWNER",
    "phone": "+91 9876543210"
  }
]
```

---

## Customers

### POST /api/customers

Add new customer (Owner only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Restaurant ABC",
  "phone": "+91 9876543210",
  "address": "123 Main Street, City"
}
```

**Response (201):**
```json
{
  "message": "Customer added successfully"
}
```

---

### GET /api/customers

Get all customers.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Restaurant ABC",
    "phone": "+91 9876543210",
    "address": "123 Main Street"
  }
]
```

---

## Vendors

### POST /api/vendors/vendors

Add new vendor (Owner only).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Harbour Fisheries",
  "phone": "+91 9876543210",
  "address": "Harbour Road, Port"
}
```

**Response (201):**
```json
{
  "message": "Vendor added successfully"
}
```

---

### GET /api/vendors/vendors

Get all vendors.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Harbour Fisheries",
    "phone": "+91 9876543210",
    "address": "Harbour Road"
  }
]
```

---

## Categories

### POST /api/categories

Create new category.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Fish"
}
```

**Response (201):**
```json
{
  "message": "Category added successfully"
}
```

---

### GET /api/categories

Get all categories.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Fish"
  }
]
```

---

## Items

### POST /api/items

Create new item.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Prawns",
  "category_id": 1
}
```

**Response (201):**
```json
{
  "message": "Item added successfully"
}
```

---

### GET /api/items

Get all items.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Prawns",
    "category_id": 1,
    "category_name": "Fish"
  }
]
```

---

## Variants

### POST /api/variants

Create new variant.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "item_id": 1,
  "variant_name": "Jumbo"
}
```

**Response (201):**
```json
{
  "message": "Variant added successfully"
}
```

---

### GET /api/variants

Get all variants.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "item_id": 1,
    "item_name": "Prawns",
    "variant_name": "Jumbo"
  }
]
```

---

## Purchases

### POST /api/purchases

Create purchase order (Owner/Employee).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "vendor_id": 1,
  "supplier_type": "local",
  "date": "2024-01-15",
  "items": [
    {
      "variant_id": 1,
      "quantity": 50,
      "price_per_kg": 300
    }
  ]
}
```

**Response (201):**
```json
{
  "message": "Purchase created successfully"
}
```

---

### DELETE /api/purchases/:id

Delete purchase and restore stock (Owner only).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Purchase deleted & stock restored"
}
```

---

## Exports

### POST /api/exports

Create export/sale.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "customer_id": 1,
  "date": "2024-01-15",
  "items": [
    {
      "variant_id": 1,
      "quantity": 10,
      "price_per_kg": 500
    }
  ]
}
```

**Response (201):**
```json
{
  "message": "Export successful",
  "invoice_no": "INV1705312200000"
}
```

---

### GET /api/exports

Get all exports.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "invoice_no": "INV1705312200000",
    "date": "2024-01-15",
    "customer_name": "Restaurant ABC",
    "created_by": "John Doe",
    "items": [
      {
        "item_name": "Prawns",
        "variant_name": "Jumbo",
        "quantity": 10,
        "price_per_kg": 500,
        "total": 5000
      }
    ]
  }
]
```

---

### GET /api/exports/invoice/:id

Download invoice as PDF.

**Headers:** `Authorization: Bearer <token>`

**Response:** PDF file download

---

### DELETE /api/exports/:id

Delete export and restore stock.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Export deleted & stock restored"
}
```

---

## Conversions

### POST /api/conversions/convert

Convert raw stock to final stock.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "date": "2024-01-15",
  "notes": "Processing batch 1",
  "raw_items": [
    {
      "variant_id": 1,
      "quantity": 100
    }
  ],
  "final_items": [
    {
      "variant_id": 2,
      "quantity": 80
    }
  ]
}
```

**Response (201):**
```json
{
  "message": "Conversion completed successfully"
}
```

---

### GET /api/conversions/convert

Get conversion history.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "date": "2024-01-15",
    "notes": "Processing batch 1",
    "created_by": "John Doe",
    "raw_items": [...],
    "final_items": [...]
  }
]
```

---

### DELETE /api/conversions/convert/:id

Delete conversion and reverse stock.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Conversion deleted and stock reversed successfully"
}
```

---

## Stocks

### GET /api/stocks/raw

Get raw stock levels.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "variant_id": 1,
    "item_name": "Prawns",
    "variant_name": "Jumbo",
    "available_qty": 500
  }
]
```

---

### GET /api/stocks/final

Get final stock levels.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "variant_id": 2,
    "item_name": "Prawns",
    "variant_name": "Processed",
    "available_qty": 350
  }
]
```

---

## Payments

### POST /api/payments/customer-payment

Record customer payment.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "customer_id": 1,
  "amount": 5000
}
```

**Response (200):**
```json
{
  "message": "Customer payment recorded successfully"
}
```

---

### GET /api/payments/customer-balance/:id

Get customer balance (sales - payments).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "customer_id": 1,
  "customer_name": "Restaurant ABC",
  "totalSales": 15000,
  "totalPaid": 10000,
  "balance": 5000
}
```

---

### POST /api/payments/vendor-payment

Record vendor payment.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "vendor_id": 1,
  "amount": 10000
}
```

**Response (200):**
```json
{
  "message": "Vendor payment recorded successfully"
}
```

---

### GET /api/payments/vendor-balance/:id

Get vendor balance (purchases - payments).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "vendor_id": 1,
  "vendor_name": "Harbour Fisheries",
  "totalPurchase": 50000,
  "totalPaid": 30000,
  "balance": 20000
}
```

---

### GET /api/payments/customer-payment-history/:id

Get customer payment history.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "amount": 5000,
    "date": "2024-01-15"
  }
]
```

---

## Dashboard

### GET /api/dashboard/summary

Get dashboard summary with KPIs.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Response (200):**
```json
{
  "total_raw_stock": 1500,
  "total_final_stock": 1200,
  "today_purchase_cost": 25000,
  "today_sales_revenue": 35000,
  "today_profit": 10000,
  "month_purchase_cost": 500000,
  "month_sales_revenue": 700000,
  "month_profit": 200000,
  "total_purchase": 2000000,
  "total_sales": 2800000,
  "gross_profit": 800000,
  "vendor_payable": 50000,
  "customer_receivable": 100000,
  "top_5_buyers": [...],
  "top_5_suppliers": [...],
  "recent_activity": [...]
}
```

---

## Reports

### GET /api/reports/daily-sales

Daily sales report.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `from`: Start date (required)
- `to`: End date (required)

**Response (200):**
```json
{
  "summary": {
    "total_revenue": "150000.00",
    "total_invoices": 25,
    "avg_daily_revenue": "15000.00",
    "total_kg_sold": 500
  },
  "daily_data": [...]
}
```

---

### GET /api/reports/top-customers

Top customers by revenue.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Number of customers (default: 10)

**Response (200):**
```json
{
  "top_customers": [
    {
      "name": "Restaurant ABC",
      "phone": "+91 9876543210",
      "invoices": 15,
      "revenue": 150000,
      "avg_invoice": 10000,
      "last_order": "2024-01-15"
    }
  ]
}
```

---

### GET /api/reports/top-products

Best selling products.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Number of products (default: 10)

**Response (200):**
```json
{
  "best_sellers": [
    {
      "name": "Prawns",
      "variant_name": "Jumbo",
      "kg_sold": 500,
      "revenue": 150000,
      "avg_price": 300,
      "invoices": 30
    }
  ]
}
```

---

### GET /api/reports/revenue-performance

Revenue performance by product.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `from` (optional): Start date
- `to` (optional): End date

**Response (200):**
```json
{
  "performance": [
    {
      "product_name": "Prawns",
      "variant_name": "Jumbo",
      "total_kg_sold": 500,
      "total_revenue": 150000,
      "avg_selling_price": 300,
      "lowest_price": 280,
      "highest_price": 350
    }
  ]
}
```

---

### GET /api/reports/monthly-trends

Monthly sales trends.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `months`: Number of months (default: 6)

**Response (200):**
```json
{
  "trends": [
    {
      "month": "2024-01",
      "invoices": 150,
      "revenue": 450000,
      "total_kg": 1500
    }
  ]
}
```

---

### GET /api/reports/customer-ltv

Customer lifetime value analysis.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "high_value_customers": [
    {
      "name": "Restaurant ABC",
      "total_orders": 25,
      "lifetime_value": 250000,
      "avg_order_value": 10000,
      "first_order": "2023-06-01",
      "last_order": "2024-01-15",
      "customer_age_days": 228
    }
  ]
}
```

---

### GET /api/reports/price-trends

Price trend analysis.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `product_name` (optional): Filter by product name

**Response (200):**
```json
{
  "price_trends": [
    {
      "product": "Prawns",
      "month": "2024-01",
      "avg_price": 305,
      "min_price": 280,
      "max_price": 350,
      "transactions": 45
    }
  ]
}
```

---

## Purchase History

### GET /api/purchase-history

Get purchase history with filters.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `vendor_id` (optional): Filter by vendor
- `from` (optional): Start date
- `to` (optional): End date
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Error Responses

All error responses follow this format:

**400 Bad Request:**
```json
{
  "message": "Validation error description"
}
```

**401 Unauthorized:**
```json
{
  "message": "Invalid credentials"
}
```

**403 Forbidden:**
```json
{
  "message": "Access denied"
}
```

**404 Not Found:**
```json
{
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Internal server error"
}
```

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests / 15 minutes |
| Login | 5 attempts / 15 minutes |
| Payments | 20 requests / 1 minute |

---

## Interactive Documentation

Access Swagger UI at: `/api-docs`
