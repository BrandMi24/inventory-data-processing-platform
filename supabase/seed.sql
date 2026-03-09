-- ============================================================================
-- INVENTORY DATA PROCESSING PLATFORM - SEED DATA
-- ============================================================================
-- Sample data for development and testing
-- ============================================================================

-- Clear existing data (for dev/test environments only)
-- TRUNCATE inventory_movements, staging_inventory_rows, upload_batches, products, warehouses CASCADE;

-- ============================================================================
-- SEED WAREHOUSES
-- ============================================================================
INSERT INTO warehouses (name, location, is_active) VALUES
    ('Main Warehouse', '123 Industrial Ave, Building A', TRUE),
    ('Secondary Warehouse', '456 Commerce Blvd, Suite 100', TRUE),
    ('Distribution Center', '789 Logistics Way', TRUE),
    ('Returns Center', '321 Processing Lane', TRUE),
    ('Overflow Storage', '555 Storage Drive', FALSE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED PRODUCTS
-- ============================================================================
INSERT INTO products (sku, name, min_stock) VALUES
    ('A100', 'Oil Filter - Standard', 50),
    ('A101', 'Oil Filter - Premium', 30),
    ('A102', 'Oil Filter - Heavy Duty', 25),
    ('B200', 'Spark Plug - Standard', 100),
    ('B201', 'Spark Plug - Platinum', 75),
    ('B202', 'Spark Plug - Iridium', 50),
    ('C300', 'Air Filter - Sedan', 60),
    ('C301', 'Air Filter - SUV', 45),
    ('C302', 'Air Filter - Truck', 40),
    ('D400', 'Brake Pad Set - Front', 80),
    ('D401', 'Brake Pad Set - Rear', 60),
    ('D402', 'Brake Rotor - Front', 40),
    ('D403', 'Brake Rotor - Rear', 35),
    ('E500', 'Windshield Wiper - 20in', 100),
    ('E501', 'Windshield Wiper - 22in', 90),
    ('E502', 'Windshield Wiper - 24in', 80),
    ('F600', 'Headlight Bulb - Halogen', 150),
    ('F601', 'Headlight Bulb - LED', 75),
    ('F602', 'Headlight Bulb - HID', 50),
    ('G700', 'Motor Oil 5W-30 - 1Qt', 200),
    ('G701', 'Motor Oil 5W-30 - 5Qt', 100),
    ('G702', 'Motor Oil 10W-40 - 1Qt', 150),
    ('H800', 'Antifreeze - 1Gal', 120),
    ('H801', 'Windshield Washer Fluid', 200),
    ('I900', 'Battery - Standard', 40),
    ('I901', 'Battery - Premium', 25)
ON CONFLICT (sku) DO NOTHING;

-- ============================================================================
-- SEED SAMPLE BATCH
-- ============================================================================
INSERT INTO upload_batches (id, file_name, file_type, total_rows, valid_rows, invalid_rows, processed_rows, status, uploaded_at, processed_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'initial_inventory_march.csv', 'csv', 15, 14, 1, 14, 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('22222222-2222-2222-2222-222222222222', 'weekly_restock_w10.xlsx', 'xlsx', 8, 8, 0, 8, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    ('33333333-3333-3333-3333-333333333333', 'daily_sales_0308.csv', 'csv', 5, 5, 0, 5, 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED INVENTORY MOVEMENTS (Initial Stock)
-- ============================================================================
DO $$
DECLARE
    v_main_warehouse UUID;
    v_secondary_warehouse UUID;
    v_distribution_center UUID;
BEGIN
    -- Get warehouse IDs
    SELECT id INTO v_main_warehouse FROM warehouses WHERE name = 'Main Warehouse';
    SELECT id INTO v_secondary_warehouse FROM warehouses WHERE name = 'Secondary Warehouse';
    SELECT id INTO v_distribution_center FROM warehouses WHERE name = 'Distribution Center';
    
    -- Insert initial IN movements for Main Warehouse
    INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, unit_cost, movement_date, reference, batch_id)
    SELECT 
        p.id,
        v_main_warehouse,
        'IN',
        CASE 
            WHEN p.sku LIKE 'A%' THEN 100
            WHEN p.sku LIKE 'B%' THEN 200
            WHEN p.sku LIKE 'C%' THEN 80
            WHEN p.sku LIKE 'D%' THEN 60
            ELSE 150
        END,
        CASE 
            WHEN p.sku LIKE 'A%' THEN 45.99
            WHEN p.sku LIKE 'B%' THEN 12.50
            WHEN p.sku LIKE 'C%' THEN 28.75
            WHEN p.sku LIKE 'D%' THEN 65.00
            WHEN p.sku LIKE 'I%' THEN 125.00
            ELSE 15.00
        END,
        CURRENT_DATE - INTERVAL '30 days',
        'PO-INIT-001',
        '11111111-1111-1111-1111-111111111111'
    FROM products p
    WHERE p.sku IN ('A100', 'A101', 'B200', 'B201', 'C300', 'D400', 'D401', 'E500', 'F600', 'G700', 'H800', 'I900')
    ON CONFLICT DO NOTHING;
    
    -- Insert some OUT movements (sales)
    INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, unit_cost, movement_date, reference, batch_id)
    SELECT 
        p.id,
        v_main_warehouse,
        'OUT',
        CASE 
            WHEN p.sku = 'A100' THEN 75  -- Will be low stock (100-75=25 < 50)
            WHEN p.sku = 'B200' THEN 150
            WHEN p.sku = 'D400' THEN 55  -- Almost low stock
            ELSE 30
        END,
        CASE 
            WHEN p.sku LIKE 'A%' THEN 45.99
            WHEN p.sku LIKE 'B%' THEN 12.50
            WHEN p.sku LIKE 'D%' THEN 65.00
            ELSE 15.00
        END,
        CURRENT_DATE - INTERVAL '10 days',
        'SO-SALES-001',
        '33333333-3333-3333-3333-333333333333'
    FROM products p
    WHERE p.sku IN ('A100', 'B200', 'D400', 'E500', 'F600')
    ON CONFLICT DO NOTHING;
    
    -- Insert restock movement
    INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, unit_cost, movement_date, reference, batch_id)
    SELECT 
        p.id,
        v_main_warehouse,
        'IN',
        50,
        CASE 
            WHEN p.sku LIKE 'B%' THEN 12.50
            WHEN p.sku LIKE 'C%' THEN 28.75
            ELSE 20.00
        END,
        CURRENT_DATE - INTERVAL '3 days',
        'PO-RESTOCK-002',
        '22222222-2222-2222-2222-222222222222'
    FROM products p
    WHERE p.sku IN ('B200', 'B201', 'C300')
    ON CONFLICT DO NOTHING;
    
    -- Insert movements for Secondary Warehouse
    INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, unit_cost, movement_date, reference, batch_id)
    SELECT 
        p.id,
        v_secondary_warehouse,
        'IN',
        75,
        CASE 
            WHEN p.sku LIKE 'G%' THEN 8.99
            WHEN p.sku LIKE 'H%' THEN 5.50
            ELSE 15.00
        END,
        CURRENT_DATE - INTERVAL '20 days',
        'PO-SEC-001',
        '11111111-1111-1111-1111-111111111111'
    FROM products p
    WHERE p.sku IN ('G700', 'G701', 'H800', 'H801')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- SEED STAGING ROWS (Example of pending and invalid rows)
-- ============================================================================
INSERT INTO staging_inventory_rows (batch_id, row_number, raw_product_sku, raw_product_name, raw_warehouse, raw_movement_type, raw_quantity, raw_unit_cost, raw_movement_date, raw_reference, status, error_message)
VALUES 
    -- Invalid row from first batch
    ('11111111-1111-1111-1111-111111111111', 15, '', 'Unknown Product', 'Main Warehouse', 'IN', '10', '25.00', '2025-03-01', 'PO-ERR-001', 'invalid', 'SKU cannot be empty'),
    -- Some processed rows
    ('11111111-1111-1111-1111-111111111111', 1, 'A100', 'Oil Filter - Standard', 'Main Warehouse', 'IN', '100', '45.99', '2025-02-07', 'PO-INIT-001', 'processed', NULL),
    ('11111111-1111-1111-1111-111111111111', 2, 'B200', 'Spark Plug - Standard', 'Main Warehouse', 'IN', '200', '12.50', '2025-02-07', 'PO-INIT-001', 'processed', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFY SEED DATA
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Seed data loaded successfully!';
    RAISE NOTICE 'Products: %', (SELECT COUNT(*) FROM products);
    RAISE NOTICE 'Warehouses: %', (SELECT COUNT(*) FROM warehouses);
    RAISE NOTICE 'Upload Batches: %', (SELECT COUNT(*) FROM upload_batches);
    RAISE NOTICE 'Inventory Movements: %', (SELECT COUNT(*) FROM inventory_movements);
    RAISE NOTICE 'Staging Rows: %', (SELECT COUNT(*) FROM staging_inventory_rows);
END $$;
