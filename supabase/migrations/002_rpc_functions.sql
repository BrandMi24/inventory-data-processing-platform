-- ============================================================================
-- INVENTORY DATA PROCESSING PLATFORM - RPC FUNCTIONS
-- ============================================================================
-- PostgreSQL functions exposed via Supabase RPC
-- These provide complex business logic that would be inefficient on the client
-- ============================================================================

-- ============================================================================
-- RPC #1: get_inventory_summary()
-- ============================================================================
-- Returns current stock by product, calculating IN minus OUT movements
-- This is the core inventory query for dashboards and reports
-- ============================================================================
CREATE OR REPLACE FUNCTION get_inventory_summary()
RETURNS TABLE (
    product_id UUID,
    sku VARCHAR(50),
    product_name VARCHAR(255),
    min_stock INTEGER,
    total_in BIGINT,
    total_out BIGINT,
    current_stock BIGINT,
    total_value DECIMAL(14, 2),
    is_low_stock BOOLEAN,
    last_movement_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH movement_summary AS (
        SELECT
            im.product_id,
            SUM(CASE WHEN im.movement_type = 'IN' THEN im.quantity ELSE 0 END) AS total_in,
            SUM(CASE WHEN im.movement_type = 'OUT' THEN im.quantity ELSE 0 END) AS total_out,
            SUM(CASE 
                WHEN im.movement_type = 'IN' THEN im.total_cost 
                ELSE -im.total_cost 
            END) AS total_value,
            MAX(im.movement_date) AS last_movement_date
        FROM inventory_movements im
        GROUP BY im.product_id
    )
    SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        p.min_stock,
        COALESCE(ms.total_in, 0)::BIGINT AS total_in,
        COALESCE(ms.total_out, 0)::BIGINT AS total_out,
        (COALESCE(ms.total_in, 0) - COALESCE(ms.total_out, 0))::BIGINT AS current_stock,
        COALESCE(ms.total_value, 0)::DECIMAL(14, 2) AS total_value,
        (COALESCE(ms.total_in, 0) - COALESCE(ms.total_out, 0)) < p.min_stock AS is_low_stock,
        ms.last_movement_date
    FROM products p
    LEFT JOIN movement_summary ms ON p.id = ms.product_id
    ORDER BY p.sku;
END;
$$;

COMMENT ON FUNCTION get_inventory_summary() IS 'Returns current stock levels for all products with IN/OUT totals and low-stock flags';

-- ============================================================================
-- RPC #2: get_low_stock_products()
-- ============================================================================
-- Returns products where current stock is below minimum stock threshold
-- Critical for inventory alerts and reorder notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
    product_id UUID,
    sku VARCHAR(50),
    product_name VARCHAR(255),
    min_stock INTEGER,
    current_stock BIGINT,
    stock_deficit BIGINT,
    last_movement_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH stock_levels AS (
        SELECT
            p.id AS product_id,
            p.sku,
            p.name AS product_name,
            p.min_stock,
            COALESCE(SUM(CASE WHEN im.movement_type = 'IN' THEN im.quantity ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN im.movement_type = 'OUT' THEN im.quantity ELSE 0 END), 0) AS current_stock,
            MAX(im.movement_date) AS last_movement_date
        FROM products p
        LEFT JOIN inventory_movements im ON p.id = im.product_id
        GROUP BY p.id, p.sku, p.name, p.min_stock
    )
    SELECT
        sl.product_id,
        sl.sku,
        sl.product_name,
        sl.min_stock,
        sl.current_stock::BIGINT,
        (sl.min_stock - sl.current_stock)::BIGINT AS stock_deficit,
        sl.last_movement_date
    FROM stock_levels sl
    WHERE sl.current_stock < sl.min_stock
    ORDER BY (sl.min_stock - sl.current_stock) DESC;
END;
$$;

COMMENT ON FUNCTION get_low_stock_products() IS 'Returns products with stock below minimum threshold for reorder alerts';

-- ============================================================================
-- RPC #3: process_staging_to_movements(batch_id)
-- ============================================================================
-- Processes valid staging rows and inserts them into inventory_movements
-- Creates products/warehouses if they don't exist (auto-creation mode)
-- This is the core batch processing function
-- ============================================================================
CREATE OR REPLACE FUNCTION process_staging_to_movements(p_batch_id UUID)
RETURNS TABLE (
    processed_count INTEGER,
    created_products INTEGER,
    created_warehouses INTEGER,
    error_count INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_created_products INTEGER := 0;
    v_created_warehouses INTEGER := 0;
    v_error_count INTEGER := 0;
    v_row RECORD;
    v_product_id UUID;
    v_warehouse_id UUID;
BEGIN
    -- Validate batch exists and is in correct status
    IF NOT EXISTS (SELECT 1 FROM upload_batches WHERE id = p_batch_id) THEN
        RETURN QUERY SELECT 0, 0, 0, 0, 'Batch not found'::TEXT;
        RETURN;
    END IF;
    
    -- Update batch status to processing
    UPDATE upload_batches 
    SET status = 'processing' 
    WHERE id = p_batch_id;
    
    -- Process each valid staging row
    FOR v_row IN 
        SELECT * FROM staging_inventory_rows 
        WHERE batch_id = p_batch_id AND status = 'valid'
        ORDER BY row_number
    LOOP
        BEGIN
            -- Find or create product
            SELECT id INTO v_product_id 
            FROM products 
            WHERE UPPER(TRIM(sku)) = UPPER(TRIM(v_row.raw_product_sku));
            
            IF v_product_id IS NULL THEN
                INSERT INTO products (sku, name, min_stock)
                VALUES (
                    UPPER(TRIM(v_row.raw_product_sku)),
                    TRIM(v_row.raw_product_name),
                    10  -- Default min_stock
                )
                RETURNING id INTO v_product_id;
                v_created_products := v_created_products + 1;
            END IF;
            
            -- Find or create warehouse
            SELECT id INTO v_warehouse_id 
            FROM warehouses 
            WHERE UPPER(TRIM(name)) = UPPER(TRIM(v_row.raw_warehouse));
            
            IF v_warehouse_id IS NULL THEN
                INSERT INTO warehouses (name, location)
                VALUES (
                    TRIM(v_row.raw_warehouse),
                    'Auto-created'
                )
                RETURNING id INTO v_warehouse_id;
                v_created_warehouses := v_created_warehouses + 1;
            END IF;
            
            -- Insert inventory movement
            INSERT INTO inventory_movements (
                product_id,
                warehouse_id,
                movement_type,
                quantity,
                unit_cost,
                movement_date,
                reference,
                batch_id,
                staging_row_id
            )
            VALUES (
                v_product_id,
                v_warehouse_id,
                UPPER(TRIM(v_row.raw_movement_type)),
                v_row.raw_quantity::INTEGER,
                v_row.raw_unit_cost::DECIMAL(12, 2),
                v_row.raw_movement_date::DATE,
                NULLIF(TRIM(v_row.raw_reference), ''),
                p_batch_id,
                v_row.id
            );
            
            -- Update staging row status
            UPDATE staging_inventory_rows 
            SET status = 'processed', processed_at = NOW()
            WHERE id = v_row.id;
            
            v_processed_count := v_processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark row as failed and continue
            UPDATE staging_inventory_rows 
            SET status = 'invalid', 
                error_message = SQLERRM
            WHERE id = v_row.id;
            v_error_count := v_error_count + 1;
        END;
    END LOOP;
    
    -- Update batch status
    UPDATE upload_batches 
    SET 
        status = 'completed',
        processed_rows = v_processed_count,
        processed_at = NOW()
    WHERE id = p_batch_id;
    
    RETURN QUERY SELECT 
        v_processed_count,
        v_created_products,
        v_created_warehouses,
        v_error_count,
        FORMAT('Processed %s rows, created %s products and %s warehouses, %s errors',
            v_processed_count, v_created_products, v_created_warehouses, v_error_count)::TEXT;
END;
$$;

COMMENT ON FUNCTION process_staging_to_movements(UUID) IS 'Processes valid staging rows into inventory_movements, auto-creating products/warehouses as needed';

-- ============================================================================
-- RPC #4: get_batch_summary(batch_id)
-- ============================================================================
-- Returns detailed summary for a specific batch
-- ============================================================================
CREATE OR REPLACE FUNCTION get_batch_summary(p_batch_id UUID)
RETURNS TABLE (
    batch_id UUID,
    file_name VARCHAR(255),
    file_type VARCHAR(10),
    status VARCHAR(20),
    total_rows INTEGER,
    pending_rows BIGINT,
    valid_rows BIGINT,
    invalid_rows BIGINT,
    processed_rows BIGINT,
    uploaded_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ub.id AS batch_id,
        ub.file_name,
        ub.file_type,
        ub.status,
        ub.total_rows,
        COUNT(*) FILTER (WHERE sr.status = 'pending')::BIGINT AS pending_rows,
        COUNT(*) FILTER (WHERE sr.status = 'valid')::BIGINT AS valid_rows,
        COUNT(*) FILTER (WHERE sr.status = 'invalid')::BIGINT AS invalid_rows,
        COUNT(*) FILTER (WHERE sr.status = 'processed')::BIGINT AS processed_rows,
        ub.uploaded_at,
        ub.processed_at
    FROM upload_batches ub
    LEFT JOIN staging_inventory_rows sr ON ub.id = sr.batch_id
    WHERE ub.id = p_batch_id
    GROUP BY ub.id, ub.file_name, ub.file_type, ub.status, ub.total_rows, ub.uploaded_at, ub.processed_at;
END;
$$;

COMMENT ON FUNCTION get_batch_summary(UUID) IS 'Returns detailed row counts and status for a specific upload batch';

-- ============================================================================
-- RPC #5: get_dashboard_metrics()
-- ============================================================================
-- Returns key metrics for the dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS TABLE (
    total_products BIGINT,
    total_warehouses BIGINT,
    total_batches BIGINT,
    total_movements BIGINT,
    total_in_value DECIMAL(14, 2),
    total_out_value DECIMAL(14, 2),
    low_stock_count BIGINT,
    pending_batches BIGINT,
    recent_batches_24h BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM products)::BIGINT AS total_products,
        (SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE)::BIGINT AS total_warehouses,
        (SELECT COUNT(*) FROM upload_batches)::BIGINT AS total_batches,
        (SELECT COUNT(*) FROM inventory_movements)::BIGINT AS total_movements,
        COALESCE((SELECT SUM(total_cost) FROM inventory_movements WHERE movement_type = 'IN'), 0)::DECIMAL(14, 2) AS total_in_value,
        COALESCE((SELECT SUM(total_cost) FROM inventory_movements WHERE movement_type = 'OUT'), 0)::DECIMAL(14, 2) AS total_out_value,
        (
            SELECT COUNT(*) 
            FROM (
                SELECT p.id
                FROM products p
                LEFT JOIN inventory_movements im ON p.id = im.product_id
                GROUP BY p.id, p.min_stock
                HAVING COALESCE(SUM(CASE WHEN im.movement_type = 'IN' THEN im.quantity ELSE 0 END), 0) -
                       COALESCE(SUM(CASE WHEN im.movement_type = 'OUT' THEN im.quantity ELSE 0 END), 0) < p.min_stock
            ) low_stock
        )::BIGINT AS low_stock_count,
        (SELECT COUNT(*) FROM upload_batches WHERE status = 'pending')::BIGINT AS pending_batches,
        (SELECT COUNT(*) FROM upload_batches WHERE uploaded_at > NOW() - INTERVAL '24 hours')::BIGINT AS recent_batches_24h;
END;
$$;

COMMENT ON FUNCTION get_dashboard_metrics() IS 'Returns aggregated metrics for the main dashboard';
