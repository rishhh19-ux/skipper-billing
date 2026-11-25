# Skipper Billing & POS System

A complete retail Point of Sale (POS) and billing system built with **Node.js, Express, and MongoDB**. Features an intuitive cashier web interface, automatic tax and discount calculations, printable invoice generation, and sales analytics.

---

## 📋 Features

- **Integrated POS Web Interface**: Clean, responsive cashier dashboard for fast item entry, quantity adjustments, and one-click checkout.
- **Printable Invoices**: Built-in formatted HTML invoices optimized for thermal receipt printers and standard page printing (`window.print()`).
- **RESTful API**: Full CRUD operations for managing invoices, line items, and customer information.
- **Flexible Financials**: Configurable GST/tax rates, line-item discounts, overall invoice discounts, and multiple payment methods (Cash, UPI, Card, Credit).
- **Sales Analytics & Reports**: Live overview of total revenue, invoice counts, average ticket size, and payment method distribution.
- **MongoDB & Mongoose**: Scalable document storage with automatic indexing on invoice numbers and customer details.

---

## 📂 Project Structure

```text
billing system/
├── server.js                     # Main server entry point & static file hosting
├── shop.env                      # Environment configuration (PORT, MONGO_URI)
├── package.json                  # Dependencies & start scripts
├── models/
│   └── Bill.js                   # Mongoose schema for bills, items & customers
├── controllers/
│   └── billController.js         # Business logic, calculations & invoice HTML rendering
├── routes/
│   └── billRoutes.js             # API routes under /api/bills
├── public/                       # Frontend POS Dashboard
│   ├── index.html                # POS cashier UI, history tab & analytics
│   ├── style.css                 # Responsive modern styling
│   └── app.js                    # Client-side state, cart management & API calls
└── README.md                     # Documentation
```

---

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) (v16.x or later)
- [MongoDB](https://www.mongodb.com/) (local service or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Verify or update your connection string in `shop.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/skipper_billing
```

> **Using MongoDB Atlas?** Update `MONGO_URI` with your connection string:
> `mongodb+srv://<username>:<password>@cluster0.mongodb.net/skipper_billing?retryWrites=true&w=majority`

### 3. Start the Application

Development mode (auto-reload on save):
```bash
npm run dev
```

Production start:
```bash
npm start
```

### 4. Access the POS Dashboard

Open your web browser and navigate to:
```text
http://localhost:5000
```

---

## 📡 API Reference

### Health Check

- **URL:** `/api/health`
- **Method:** `GET`
- **Response:** `{ "status": "ok", "message": "Skipper billing server is running" }`

### Bills API (`/api/bills`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/bills` | Fetch bills (supports `?search=`, `?status=`, `?page=`, `?limit=`) |
| `POST` | `/api/bills` | Create a new bill (auto-generates invoice number) |
| `GET` | `/api/bills/:id` | Fetch bill by MongoDB ID or invoice number |
| `PUT` | `/api/bills/:id` | Update an existing bill (recalculates totals) |
| `DELETE` | `/api/bills/:id` | Delete an invoice |
| `GET` | `/api/bills/:id/print` | Render a clean, printable HTML invoice |
| `GET` | `/api/bills/stats` | Retrieve sales analytics and payment breakdowns |

---

## 🖨️ Printing Invoices

- Each invoice has a dedicated print URL: `/api/bills/<id>/print`.
- Clicking **"Complete & Print Invoice"** in the POS automatically saves the bill to MongoDB and opens the printable receipt.
- The invoice template includes dedicated print styles (`@media print`) that automatically hide non-printable UI buttons.
