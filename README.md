# Inventory Data Processing Platform

A production-style web application for processing, validating, and managing inventory data. Built with React, TypeScript, Vite, and Supabase.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

## 📋 Overview

This application simulates a real internal business tool for inventory data processing and validation. Users can:

- **Upload** CSV or Excel inventory files
- **Parse** files client-side with PapaParse and SheetJS
- **Validate** data with Zod schemas and business rules
- **Preview** parsed data before submission
- **Process** valid rows into inventory movements
- **Monitor** dashboards, batch uploads, and error reports

## 🎯 Features

### File Processing
- CSV parsing with PapaParse
- Excel (.xlsx, .xls) parsing with SheetJS
- Header mapping with common aliases
- Data normalization (trimming, case conversion, date formatting)

### Validation
- Zod schema validation
- Business rule enforcement
- Duplicate detection
- Detailed error messages per row

### Database Operations
- PostgreSQL with Supabase
- Staging table workflow
- Batch processing via RPC functions
- Auto-creation of products/warehouses

### Dashboard & Reports
- Real-time inventory summary
- Low stock alerts
- Upload batch history
- Invalid row diagnostics

## 🗂️ Project Structure

```
inventory-data-processing-platform/
├── public/
│   ├── sample-inventory.csv      # Sample valid file for testing
│   └── sample-with-errors.csv    # Sample file with invalid rows
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base components (LoadingSpinner, etc.)
│   │   ├── DataPreviewTable.tsx
│   │   ├── Layout.tsx
│   │   └── ValidationSummary.tsx
│   ├── lib/
│   │   └── supabase.ts           # Supabase client configuration
│   ├── pages/
│   │   ├── BatchesPage.tsx       # Upload history
│   │   ├── DashboardPage.tsx     # Main dashboard
│   │   ├── ErrorsPage.tsx        # Invalid row viewer
│   │   ├── InventoryPage.tsx     # Stock levels
│   │   └── UploadPage.tsx        # File upload
│   ├── services/
│   │   └── inventoryService.ts   # Database operations
│   ├── types/
│   │   └── database.ts           # TypeScript interfaces
│   ├── utils/
│   │   ├── formatters.ts         # Display formatters
│   │   ├── normalizeRows.ts      # Data normalization
│   │   ├── parseCsv.ts           # CSV parsing
│   │   ├── parseExcel.ts         # Excel parsing
│   │   └── validateRows.ts       # Zod validation
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql        # Database tables
│   │   └── 002_rpc_functions.sql # PostgreSQL functions
│   └── seed.sql                  # Sample data
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

### 1. Clone and Install

```bash
cd inventory-data-processing-platform
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your:
   - Project URL
   - Anon public key

3. Create `.env` from the example:

```bash
cp .env.example .env
```

4. Add your credentials to `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Database

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the migrations in order:
   - Copy and run `supabase/migrations/001_schema.sql`
   - Copy and run `supabase/migrations/002_rpc_functions.sql`
3. (Optional) Run `supabase/seed.sql` to add sample data

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `products` | Product catalog with SKU and min_stock |
| `warehouses` | Warehouse/location master data |
| `upload_batches` | File upload metadata and status |
| `staging_inventory_rows` | Raw parsed rows awaiting processing |
| `inventory_movements` | Validated IN/OUT transactions |

### RPC Functions

| Function | Description |
|----------|-------------|
| `get_inventory_summary()` | Current stock by product (IN - OUT) |
| `get_low_stock_products()` | Products below min_stock threshold |
| `get_dashboard_metrics()` | Aggregated dashboard statistics |
| `process_staging_to_movements(batch_id)` | Move valid staging rows to movements |
| `get_batch_summary(batch_id)` | Detailed status for a specific batch |

## 📁 File Format

### Expected CSV/Excel Structure

```csv
sku,product_name,warehouse,movement_type,quantity,unit_cost,movement_date,reference
A100,Oil Filter,Main Warehouse,IN,50,120.50,2025-03-01,PO-1001
A100,Oil Filter,Main Warehouse,OUT,10,120.50,2025-03-02,SO-2001
```

### Column Rules

| Column | Required | Rules |
|--------|----------|-------|
| `sku` | Yes | Non-empty string, max 50 chars |
| `product_name` | Yes | Non-empty string, max 255 chars |
| `warehouse` | Yes | Non-empty string, max 100 chars |
| `movement_type` | Yes | Must be `IN` or `OUT` |
| `quantity` | Yes | Positive integer |
| `unit_cost` | Yes | Non-negative decimal |
| `movement_date` | Yes | Valid date (YYYY-MM-DD or MM/DD/YYYY) |
| `reference` | No | PO/SO number, max 100 chars |

### Header Aliases

The parser supports common header variations:
- `sku`, `product_sku`, `item_sku`
- `product_name`, `name`, `item_name`
- `warehouse`, `warehouse_name`, `location`
- `movement_type`, `type`
- `quantity`, `qty`, `amount`
- `unit_cost`, `cost`, `price`
- `movement_date`, `date`
- `reference`, `ref`, `po_number`

## 🧪 Testing the App

1. Download sample files from the `public/` folder
2. Navigate to the **Upload** page
3. Upload `sample-inventory.csv` for valid data
4. Upload `sample-with-errors.csv` to test error handling
5. Check the **Dashboard** for updated metrics
6. View **Batches** for upload history
7. Check **Errors** page for invalid row details

## 🛠️ Development

### Available Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
npm run type-check # TypeScript type checking
```

### Tech Stack

- **Frontend**: React 18, TypeScript 5, Vite 5
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **Routing**: React Router 6
- **File Parsing**: PapaParse, SheetJS (xlsx)
- **Validation**: Zod
- **Backend**: Supabase (PostgreSQL + PostgREST)

## 🔮 Future Improvements (v2)

### Authentication & Security
- [ ] User authentication with Supabase Auth
- [ ] Row-Level Security (RLS) policies
- [ ] Audit logging for data changes

### Enhanced Features
- [ ] Negative stock prevention in SQL
- [ ] Batch reprocessing workflow
- [ ] Export processed data to CSV
- [ ] Product/warehouse management UI
- [ ] Movement history per product

### Advanced Processing
- [ ] Supabase Edge Functions for heavy processing
- [ ] Background job queue for large files
- [ ] Email notifications for low stock
- [ ] Scheduled inventory reports

### UI/UX
- [ ] Dark mode support
- [ ] Mobile responsive navigation
- [ ] Real-time updates with Supabase subscriptions
- [ ] Data visualization charts
- [ ] Batch progress indicators

### Infrastructure
- [ ] CI/CD pipeline
- [ ] Environment-based configurations
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring

## 📝 License

MIT License - feel free to use this project as a portfolio piece or starting point for your own inventory system.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

Built with ❤️ using React, TypeScript, and Supabase
