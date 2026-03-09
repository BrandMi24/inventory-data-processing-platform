/**
 * Inventory Service
 * Handles all database operations for inventory data
 */

import { supabase } from '@/lib/supabase';
import type {
  UploadBatch,
  StagingInventoryRow,
  InsertUploadBatch,
  InsertStagingRow,
  ParsedInventoryRow,
  InventorySummaryItem,
  LowStockProduct,
  DashboardMetrics,
  ProcessBatchResult,
  InventoryMovement,
  Product,
  Warehouse,
} from '@/types';

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Create a new upload batch record
 */
export async function createUploadBatch(
  batch: InsertUploadBatch
): Promise<{ data: UploadBatch | null; error: string | null }> {
  const { data, error } = await supabase
    .from('upload_batches')
    .insert(batch)
    .select()
    .single();

  if (error) {
    console.error('Error creating upload batch:', error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Get all upload batches
 */
export async function getUploadBatches(limit = 50): Promise<{
  data: UploadBatch[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('upload_batches')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching upload batches:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

/**
 * Get a single upload batch by ID
 */
export async function getUploadBatch(batchId: string): Promise<{
  data: UploadBatch | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('upload_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (error) {
    console.error('Error fetching upload batch:', error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Update upload batch status
 */
export async function updateBatchStatus(
  batchId: string,
  status: UploadBatch['status'],
  errorMessage?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('upload_batches')
    .update({ 
      status, 
      error_message: errorMessage || null,
      processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    })
    .eq('id', batchId);

  if (error) {
    console.error('Error updating batch status:', error);
    return { error: error.message };
  }

  return { error: null };
}

// =============================================================================
// STAGING ROW OPERATIONS
// =============================================================================

/**
 * Insert staging rows for a batch
 */
export async function insertStagingRows(
  rows: InsertStagingRow[]
): Promise<{ error: string | null; insertedCount: number }> {
  if (rows.length === 0) {
    return { error: null, insertedCount: 0 };
  }

  // Insert in batches of 100 to avoid payload limits
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('staging_inventory_rows').insert(batch);

    if (error) {
      console.error('Error inserting staging rows:', error);
      return { error: error.message, insertedCount };
    }

    insertedCount += batch.length;
  }

  return { error: null, insertedCount };
}

/**
 * Get staging rows for a batch
 */
export async function getStagingRows(
  batchId: string,
  statusFilter?: StagingInventoryRow['status']
): Promise<{ data: StagingInventoryRow[]; error: string | null }> {
  let query = supabase
    .from('staging_inventory_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_number', { ascending: true });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching staging rows:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

/**
 * Get invalid rows across all batches or for a specific batch
 */
export async function getInvalidRows(
  batchId?: string,
  limit = 100
): Promise<{ data: StagingInventoryRow[]; error: string | null }> {
  let query = supabase
    .from('staging_inventory_rows')
    .select('*')
    .eq('status', 'invalid')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (batchId) {
    query = query.eq('batch_id', batchId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching invalid rows:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

// =============================================================================
// INVENTORY OPERATIONS
// =============================================================================

/**
 * Get inventory movements
 */
export async function getInventoryMovements(
  options: {
    productId?: string;
    warehouseId?: string;
    limit?: number;
  } = {}
): Promise<{ data: InventoryMovement[]; error: string | null }> {
  let query = supabase
    .from('inventory_movements')
    .select('*')
    .order('movement_date', { ascending: false })
    .limit(options.limit || 100);

  if (options.productId) {
    query = query.eq('product_id', options.productId);
  }

  if (options.warehouseId) {
    query = query.eq('warehouse_id', options.warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching inventory movements:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

// =============================================================================
// RPC FUNCTIONS
// =============================================================================

/**
 * Get inventory summary (stock levels for all products)
 */
export async function getInventorySummary(): Promise<{
  data: InventorySummaryItem[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_inventory_summary');

  if (error) {
    console.error('Error fetching inventory summary:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(): Promise<{
  data: LowStockProduct[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_low_stock_products');

  if (error) {
    console.error('Error fetching low stock products:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

/**
 * Get dashboard metrics
 */
export async function getDashboardMetrics(): Promise<{
  data: DashboardMetrics | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_dashboard_metrics');

  if (error) {
    console.error('Error fetching dashboard metrics:', error);
    return { data: null, error: error.message };
  }

  // RPC returns an array, get first item
  return { data: data?.[0] || null, error: null };
}

/**
 * Process staging rows to inventory movements
 */
export async function processBatchToMovements(batchId: string): Promise<{
  data: ProcessBatchResult | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('process_staging_to_movements', {
    p_batch_id: batchId,
  });

  if (error) {
    console.error('Error processing batch:', error);
    return { data: null, error: error.message };
  }

  // RPC returns an array, get first item
  return { data: data?.[0] || null, error: null };
}

// =============================================================================
// MASTER DATA OPERATIONS
// =============================================================================

/**
 * Get all products
 */
export async function getProducts(): Promise<{
  data: Product[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sku', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

/**
 * Get all warehouses
 */
export async function getWarehouses(): Promise<{
  data: Warehouse[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching warehouses:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

// =============================================================================
// COMBINED UPLOAD FLOW
// =============================================================================

/**
 * Complete upload flow: create batch, insert staging rows, process to movements
 */
export async function uploadInventoryFile(
  fileName: string,
  fileType: 'csv' | 'xlsx' | 'xls',
  parsedRows: ParsedInventoryRow[]
): Promise<{
  batchId: string | null;
  processResult: ProcessBatchResult | null;
  error: string | null;
}> {
  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  // Step 1: Create upload batch
  const batchResult = await createUploadBatch({
    file_name: fileName,
    file_type: fileType,
    total_rows: parsedRows.length,
    valid_rows: validRows.length,
    invalid_rows: invalidRows.length,
    status: 'processing',
  });

  if (batchResult.error || !batchResult.data) {
    return {
      batchId: null,
      processResult: null,
      error: batchResult.error || 'Failed to create upload batch',
    };
  }

  const batchId = batchResult.data.id;

  // Step 2: Insert staging rows
  const stagingRows: InsertStagingRow[] = parsedRows.map(row => ({
    batch_id: batchId,
    row_number: row.rowNumber,
    raw_product_sku: row.raw.sku || null,
    raw_product_name: row.raw.product_name || null,
    raw_warehouse: row.raw.warehouse || null,
    raw_movement_type: row.raw.movement_type || null,
    raw_quantity: row.raw.quantity || null,
    raw_unit_cost: row.raw.unit_cost || null,
    raw_movement_date: row.raw.movement_date || null,
    raw_reference: row.raw.reference || null,
    status: row.isValid ? 'valid' : 'invalid',
    error_message: row.errors.length > 0 ? row.errors.join('; ') : null,
  }));

  const stagingResult = await insertStagingRows(stagingRows);

  if (stagingResult.error) {
    await updateBatchStatus(batchId, 'failed', stagingResult.error);
    return {
      batchId,
      processResult: null,
      error: stagingResult.error,
    };
  }

  // Step 3: Process valid staging rows to inventory movements
  if (validRows.length > 0) {
    const processResult = await processBatchToMovements(batchId);

    if (processResult.error) {
      await updateBatchStatus(batchId, 'failed', processResult.error);
      return {
        batchId,
        processResult: null,
        error: processResult.error,
      };
    }

    return {
      batchId,
      processResult: processResult.data,
      error: null,
    };
  }

  // No valid rows to process
  await updateBatchStatus(batchId, 'completed');
  return {
    batchId,
    processResult: {
      processed_count: 0,
      created_products: 0,
      created_warehouses: 0,
      error_count: invalidRows.length,
      message: 'No valid rows to process',
    },
    error: null,
  };
}
