/**
 * Data Validation Utility
 * Validates inventory data using Zod schemas and custom business rules
 */

import { z } from 'zod';
import type { 
  RawInventoryRow, 
  NormalizedInventoryRow, 
  ParsedInventoryRow,
  MovementType 
} from '@/types';
import { normalizeRow } from './normalizeRows';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Schema for normalized inventory row
 * Validates the structure and types after normalization
 */
export const NormalizedRowSchema = z.object({
  sku: z.string()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be 50 characters or less'),
  
  productName: z.string()
    .min(1, 'Product name is required')
    .max(255, 'Product name must be 255 characters or less'),
  
  warehouse: z.string()
    .min(1, 'Warehouse is required')
    .max(100, 'Warehouse must be 100 characters or less'),
  
  movementType: z.enum(['IN', 'OUT'] as const, {
    errorMap: () => ({ message: 'Movement type must be IN or OUT' }),
  }),
  
  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  
  unitCost: z.number()
    .nonnegative('Unit cost must be 0 or greater')
    .max(999999999.99, 'Unit cost exceeds maximum allowed value'),
  
  movementDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  
  reference: z.string()
    .max(100, 'Reference must be 100 characters or less')
    .optional()
    .default(''),
});

/**
 * Schema for raw inventory row (pre-normalization)
 * Validates that required fields are present as strings
 */
export const RawRowSchema = z.object({
  sku: z.string(),
  product_name: z.string(),
  warehouse: z.string(),
  movement_type: z.string(),
  quantity: z.string(),
  unit_cost: z.string(),
  movement_date: z.string(),
  reference: z.string().optional().default(''),
});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalized: NormalizedInventoryRow | null;
}

/**
 * Validate a single raw inventory row
 * Attempts normalization and then validates the result
 */
export function validateRow(raw: RawInventoryRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  
  // Step 1: Check for empty required fields before normalization
  if (!raw.sku || raw.sku.trim() === '') {
    errors.push('SKU is required');
  }
  
  if (!raw.product_name || raw.product_name.trim() === '') {
    errors.push('Product name is required');
  }
  
  if (!raw.warehouse || raw.warehouse.trim() === '') {
    errors.push('Warehouse is required');
  }
  
  if (!raw.movement_type || raw.movement_type.trim() === '') {
    errors.push('Movement type is required');
  }
  
  if (!raw.quantity || raw.quantity.trim() === '') {
    errors.push('Quantity is required');
  }
  
  if (!raw.unit_cost || raw.unit_cost.trim() === '') {
    errors.push('Unit cost is required');
  }
  
  if (!raw.movement_date || raw.movement_date.trim() === '') {
    errors.push('Movement date is required');
  }
  
  // If there are already errors from empty fields, return early
  if (errors.length > 0) {
    return { isValid: false, errors, normalized: null };
  }
  
  // Step 2: Attempt normalization
  const normalized = normalizeRow(raw);
  
  if (!normalized) {
    // Normalization failed - determine which field(s) failed
    const movementType = raw.movement_type.trim().toUpperCase();
    if (!['IN', 'OUT', 'INBOUND', 'OUTBOUND', 'RECEIPT', 'SHIPMENT'].includes(movementType)) {
      errors.push(`Invalid movement type: "${raw.movement_type}". Must be IN or OUT`);
    }
    
    const qty = parseFloat(raw.quantity.replace(/,/g, ''));
    if (isNaN(qty) || qty <= 0) {
      errors.push(`Invalid quantity: "${raw.quantity}". Must be a positive number`);
    }
    
    const cost = parseFloat(raw.unit_cost.replace(/[$€£¥,]/g, ''));
    if (isNaN(cost) || cost < 0) {
      errors.push(`Invalid unit cost: "${raw.unit_cost}". Must be 0 or greater`);
    }
    
    // Check date format
    const dateTest = new Date(raw.movement_date);
    if (isNaN(dateTest.getTime())) {
      errors.push(`Invalid date format: "${raw.movement_date}". Use YYYY-MM-DD or MM/DD/YYYY`);
    }
    
    if (errors.length === 0) {
      errors.push('Failed to normalize row data');
    }
    
    return { isValid: false, errors, normalized: null };
  }
  
  // Step 3: Validate normalized data with Zod
  const zodResult = NormalizedRowSchema.safeParse(normalized);
  
  if (!zodResult.success) {
    const zodErrors = zodResult.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
    return { isValid: false, errors: zodErrors, normalized: null };
  }
  
  // Step 4: Additional business rule validations
  
  // Check for reasonable date (not too far in past or future)
  const movementDate = new Date(normalized.movementDate);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAhead = new Date();
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
  
  if (movementDate < oneYearAgo) {
    errors.push(`Movement date ${normalized.movementDate} is more than 1 year in the past`);
  }
  
  if (movementDate > oneYearAhead) {
    errors.push(`Movement date ${normalized.movementDate} is more than 1 year in the future`);
  }
  
  // Warn about very large quantities (but don't fail)
  if (normalized.quantity > 10000) {
    console.warn(`Row ${rowNumber}: Large quantity (${normalized.quantity}). Please verify.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : null,
  };
}

/**
 * Validate multiple rows and detect duplicates
 */
export function validateRows(rawRows: RawInventoryRow[]): ParsedInventoryRow[] {
  const results: ParsedInventoryRow[] = [];
  const seenKeys = new Set<string>();
  
  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1; // 1-based row numbering
    const raw = rawRows[i];
    const validation = validateRow(raw, rowNumber);
    const errors = [...validation.errors];
    
    // Check for duplicates using a composite key
    if (validation.normalized) {
      const duplicateKey = [
        validation.normalized.sku,
        validation.normalized.movementDate,
        validation.normalized.reference,
        validation.normalized.movementType,
        validation.normalized.quantity,
      ].join('|');
      
      if (seenKeys.has(duplicateKey)) {
        errors.push('Duplicate row detected (same SKU, date, reference, type, and quantity)');
      } else {
        seenKeys.add(duplicateKey);
      }
    }
    
    results.push({
      rowNumber,
      raw,
      normalized: errors.length === 0 ? validation.normalized : null,
      isValid: errors.length === 0,
      errors,
    });
  }
  
  return results;
}

/**
 * Get validation summary statistics
 */
export function getValidationSummary(parsedRows: ParsedInventoryRow[]) {
  const total = parsedRows.length;
  const valid = parsedRows.filter(r => r.isValid).length;
  const invalid = total - valid;
  
  // Group errors by type
  const errorCounts: Record<string, number> = {};
  for (const row of parsedRows) {
    for (const error of row.errors) {
      // Normalize error message for grouping (remove specific values)
      const normalizedError = error
        .replace(/"[^"]+"/g, '"..."')
        .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE');
      
      errorCounts[normalizedError] = (errorCounts[normalizedError] || 0) + 1;
    }
  }
  
  return {
    total,
    valid,
    invalid,
    validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
    errorCounts,
    topErrors: Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}
