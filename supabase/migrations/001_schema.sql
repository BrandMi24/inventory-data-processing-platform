-- ============================================================================
-- INVENTORY DATA PROCESSING PLATFORM - DATABASE SCHEMA
-- ============================================================================
-- This migration creates the core tables for the inventory processing system.
-- Run this in your Supabase SQL Editor or via migrations.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PRODUCTS TABLE
-- Master table for product catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast SKU lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- ============================================================================
-- WAREHOUSES TABLE
-- Master table for warehouse/location management
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for warehouse name lookups
CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);

-- ============================================================================
-- UPLOAD BATCHES TABLE
-- Tracks file uploads and their processing status
-- ============================================================================
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls')),
    total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
    valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
    invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
    processed_rows INTEGER NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Index for listing batches by upload date
CREATE INDEX IF NOT EXISTS idx_upload_batches_uploaded_at ON upload_batches(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_batches_status ON upload_batches(status);

-- ============================================================================
-- STAGING INVENTORY ROWS TABLE
-- Temporary storage for parsed rows before validation and processing
-- ============================================================================
CREATE TABLE IF NOT EXISTS staging_inventory_rows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    
    -- Raw data as received from the file
    raw_product_sku VARCHAR(255),
    raw_product_name VARCHAR(255),
    raw_warehouse VARCHAR(255),
    raw_movement_type VARCHAR(50),
    raw_quantity VARCHAR(50),
    raw_unit_cost VARCHAR(50),
    raw_movement_date VARCHAR(50),
    raw_reference VARCHAR(255),
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'invalid', 'processed', 'skipped')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Indexes for staging table queries
CREATE INDEX IF NOT EXISTS idx_staging_batch_id ON staging_inventory_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_inventory_rows(status);
CREATE INDEX IF NOT EXISTS idx_staging_batch_status ON staging_inventory_rows(batch_id, status);

-- ============================================================================
-- INVENTORY MOVEMENTS TABLE
-- Final validated inventory movements (IN/OUT transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    movement_type VARCHAR(3) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(12, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cost DECIMAL(14, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    movement_date DATE NOT NULL,
    reference VARCHAR(100),
    batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    staging_row_id UUID REFERENCES staging_inventory_rows(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for inventory movement queries
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse_id ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_movement_date ON inventory_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_batch_id ON inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON inventory_movements(reference);

-- Composite index for stock calculations
CREATE INDEX IF NOT EXISTS idx_movements_stock_calc ON inventory_movements(product_id, warehouse_id, movement_type);

-- Unique constraint to prevent duplicate movements
CREATE UNIQUE INDEX IF NOT EXISTS idx_movements_unique 
ON inventory_movements(product_id, warehouse_id, movement_date, reference, movement_type, quantity)
WHERE reference IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically updates updated_at timestamp on row changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to warehouses table
DROP TRIGGER IF EXISTS update_warehouses_updated_at ON warehouses;
CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE products IS 'Master product catalog with SKU and minimum stock levels';
COMMENT ON TABLE warehouses IS 'Warehouse/location master data';
COMMENT ON TABLE upload_batches IS 'Tracks uploaded files and their processing status';
COMMENT ON TABLE staging_inventory_rows IS 'Temporary storage for parsed rows awaiting validation';
COMMENT ON TABLE inventory_movements IS 'Validated inventory transactions (IN/OUT movements)';

COMMENT ON COLUMN products.min_stock IS 'Minimum stock level for low-stock alerts';
COMMENT ON COLUMN staging_inventory_rows.status IS 'pending=awaiting validation, valid=passed validation, invalid=failed validation, processed=moved to inventory_movements';
COMMENT ON COLUMN inventory_movements.total_cost IS 'Auto-calculated as quantity * unit_cost';
