/**
 * Database Types
 * TypeScript interfaces matching the PostgreSQL schema
 */

// =============================================================================
// CORE DATABASE ENTITIES
// =============================================================================

export interface Product {
  id: string;
  sku: string;
  name: string;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UploadBatch {
  id: string;
  file_name: string;
  file_type: 'csv' | 'xlsx' | 'xls';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  processed_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  uploaded_at: string;
  processed_at: string | null;
}

export type StagingRowStatus = 'pending' | 'valid' | 'invalid' | 'processed' | 'skipped';

export interface StagingInventoryRow {
  id: string;
  batch_id: string;
  row_number: number;
  raw_product_sku: string | null;
  raw_product_name: string | null;
  raw_warehouse: string | null;
  raw_movement_type: string | null;
  raw_quantity: string | null;
  raw_unit_cost: string | null;
  raw_movement_date: string | null;
  raw_reference: string | null;
  status: StagingRowStatus;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export type MovementType = 'IN' | 'OUT';

export interface InventoryMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  movement_date: string;
  reference: string | null;
  batch_id: string | null;
  staging_row_id: string | null;
  created_at: string;
}

// =============================================================================
// RPC RESPONSE TYPES
// =============================================================================

export interface InventorySummaryItem {
  product_id: string;
  sku: string;
  product_name: string;
  min_stock: number;
  total_in: number;
  total_out: number;
  current_stock: number;
  total_value: number;
  is_low_stock: boolean;
  last_movement_date: string | null;
}

export interface LowStockProduct {
  product_id: string;
  sku: string;
  product_name: string;
  min_stock: number;
  current_stock: number;
  stock_deficit: number;
  last_movement_date: string | null;
}

export interface ProcessBatchResult {
  processed_count: number;
  created_products: number;
  created_warehouses: number;
  error_count: number;
  message: string;
}

export interface BatchSummary {
  batch_id: string;
  file_name: string;
  file_type: string;
  status: string;
  total_rows: number;
  pending_rows: number;
  valid_rows: number;
  invalid_rows: number;
  processed_rows: number;
  uploaded_at: string;
  processed_at: string | null;
}

export interface DashboardMetrics {
  total_products: number;
  total_warehouses: number;
  total_batches: number;
  total_movements: number;
  total_in_value: number;
  total_out_value: number;
  low_stock_count: number;
  pending_batches: number;
  recent_batches_24h: number;
}

// =============================================================================
// FILE PARSING TYPES
// =============================================================================

export interface RawInventoryRow {
  sku: string;
  product_name: string;
  warehouse: string;
  movement_type: string;
  quantity: string;
  unit_cost: string;
  movement_date: string;
  reference: string;
}

export interface ParsedInventoryRow {
  rowNumber: number;
  raw: RawInventoryRow;
  normalized: NormalizedInventoryRow | null;
  isValid: boolean;
  errors: string[];
}

export interface NormalizedInventoryRow {
  sku: string;
  productName: string;
  warehouse: string;
  movementType: MovementType;
  quantity: number;
  unitCost: number;
  movementDate: string; // ISO format YYYY-MM-DD
  reference: string;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface FileUploadState {
  file: File | null;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'xls' | null;
  isLoading: boolean;
  error: string | null;
}

export interface ParseResult {
  rows: ParsedInventoryRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  parseErrors: string[];
}

export interface UploadProgress {
  stage: 'idle' | 'parsing' | 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
}

// =============================================================================
// INSERT PAYLOADS
// =============================================================================

export interface InsertUploadBatch {
  file_name: string;
  file_type: 'csv' | 'xlsx' | 'xls';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface InsertStagingRow {
  batch_id: string;
  row_number: number;
  raw_product_sku: string | null;
  raw_product_name: string | null;
  raw_warehouse: string | null;
  raw_movement_type: string | null;
  raw_quantity: string | null;
  raw_unit_cost: string | null;
  raw_movement_date: string | null;
  raw_reference: string | null;
  status: StagingRowStatus;
  error_message: string | null;
}

// =============================================================================
// SUPABASE DATABASE TYPE DEFINITION
// =============================================================================

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      warehouses: {
        Row: Warehouse;
        Insert: Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Warehouse, 'id' | 'created_at' | 'updated_at'>>;
      };
      upload_batches: {
        Row: UploadBatch;
        Insert: InsertUploadBatch;
        Update: Partial<InsertUploadBatch>;
      };
      staging_inventory_rows: {
        Row: StagingInventoryRow;
        Insert: InsertStagingRow;
        Update: Partial<InsertStagingRow>;
      };
      inventory_movements: {
        Row: InventoryMovement;
        Insert: Omit<InventoryMovement, 'id' | 'total_cost' | 'created_at'>;
        Update: Partial<Omit<InventoryMovement, 'id' | 'total_cost' | 'created_at'>>;
      };
    };
    Functions: {
      get_inventory_summary: {
        Args: Record<string, never>;
        Returns: InventorySummaryItem[];
      };
      get_low_stock_products: {
        Args: Record<string, never>;
        Returns: LowStockProduct[];
      };
      process_staging_to_movements: {
        Args: { p_batch_id: string };
        Returns: ProcessBatchResult[];
      };
      get_batch_summary: {
        Args: { p_batch_id: string };
        Returns: BatchSummary[];
      };
      get_dashboard_metrics: {
        Args: Record<string, never>;
        Returns: DashboardMetrics[];
      };
    };
  };
}
