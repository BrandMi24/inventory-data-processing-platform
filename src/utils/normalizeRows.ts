/**
 * Data Normalization Utility
 * Cleans and transforms raw inventory data into a consistent format
 */

import type { RawInventoryRow, NormalizedInventoryRow, MovementType } from '@/types';

/**
 * Trim and clean a string value
 * Removes leading/trailing whitespace and normalizes internal spaces
 */
function cleanString(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize movement type to uppercase IN or OUT
 */
function normalizeMovementType(value: string): MovementType | null {
  const cleaned = cleanString(value).toUpperCase();
  
  // Handle common variations
  const inVariations = ['IN', 'INBOUND', 'RECEIPT', 'RECEIVED', 'RCV', 'R'];
  const outVariations = ['OUT', 'OUTBOUND', 'SHIPMENT', 'SHIPPED', 'SHP', 'S', 'SALE'];
  
  if (inVariations.includes(cleaned)) return 'IN';
  if (outVariations.includes(cleaned)) return 'OUT';
  
  return null;
}

/**
 * Parse a quantity string to a number
 * Handles common formats: "100", "1,000", "1000.00"
 */
function parseQuantity(value: string): number | null {
  const cleaned = cleanString(value).replace(/,/g, '');
  
  if (!cleaned) return null;
  
  const num = parseFloat(cleaned);
  
  // Quantity must be a positive integer
  if (isNaN(num) || !isFinite(num) || num <= 0) return null;
  
  // Round to integer (quantities should be whole numbers)
  return Math.round(num);
}

/**
 * Parse a unit cost string to a decimal number
 * Handles common formats: "12.50", "$12.50", "12,50", "1,234.56"
 */
function parseUnitCost(value: string): number | null {
  let cleaned = cleanString(value);
  
  // Remove currency symbols
  cleaned = cleaned.replace(/[$€£¥]/g, '');
  
  // Handle European decimal format (1.234,56 -> 1234.56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // If comma comes after period, it's European format
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');
    
    if (lastComma > lastPeriod) {
      // European format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be European decimal (12,50) or US thousands (1,000)
    // If only 2 digits after comma, treat as decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  if (!cleaned) return null;
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num) || !isFinite(num) || num < 0) return null;
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

/**
 * Parse and normalize a date string to ISO format (YYYY-MM-DD)
 * Handles common formats: "2025-03-01", "03/01/2025", "01-Mar-2025", "March 1, 2025"
 */
function parseMovementDate(value: string): string | null {
  const cleaned = cleanString(value);
  
  if (!cleaned) return null;
  
  // Try parsing as Date
  let date: Date | null = null;
  
  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    date = new Date(cleaned + 'T00:00:00');
  }
  // US format: MM/DD/YYYY or MM-DD-YYYY
  else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(cleaned)) {
    const parts = cleaned.split(/[/-]/);
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    date = new Date(year, month - 1, day);
  }
  // European format: DD/MM/YYYY (less common, try to detect)
  else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(cleaned)) {
    // Already handled above - default to US format
  }
  // Text month formats: "01-Mar-2025", "March 1, 2025"
  else {
    date = new Date(cleaned);
  }
  
  // Validate the date
  if (!date || isNaN(date.getTime())) {
    return null;
  }
  
  // Check for reasonable date range (1990-2100)
  const year = date.getFullYear();
  if (year < 1990 || year > 2100) {
    return null;
  }
  
  // Format to ISO
  const isoYear = date.getFullYear();
  const isoMonth = String(date.getMonth() + 1).padStart(2, '0');
  const isoDay = String(date.getDate()).padStart(2, '0');
  
  return `${isoYear}-${isoMonth}-${isoDay}`;
}

/**
 * Normalize a single raw inventory row
 * Returns the normalized data or null if critical fields can't be parsed
 */
export function normalizeRow(raw: RawInventoryRow): NormalizedInventoryRow | null {
  const sku = cleanString(raw.sku).toUpperCase();
  const productName = cleanString(raw.product_name);
  const warehouse = cleanString(raw.warehouse);
  const movementType = normalizeMovementType(raw.movement_type);
  const quantity = parseQuantity(raw.quantity);
  const unitCost = parseUnitCost(raw.unit_cost);
  const movementDate = parseMovementDate(raw.movement_date);
  const reference = cleanString(raw.reference);
  
  // If any critical field couldn't be parsed, return null
  // (Validation will catch this and report detailed errors)
  if (!sku || !productName || !warehouse || !movementType || 
      quantity === null || unitCost === null || !movementDate) {
    return null;
  }
  
  return {
    sku,
    productName,
    warehouse,
    movementType,
    quantity,
    unitCost,
    movementDate,
    reference,
  };
}

/**
 * Normalize multiple raw inventory rows
 * Returns an object mapping row index to normalized data (or null if couldn't normalize)
 */
export function normalizeRows(rawRows: RawInventoryRow[]): Map<number, NormalizedInventoryRow | null> {
  const results = new Map<number, NormalizedInventoryRow | null>();
  
  for (let i = 0; i < rawRows.length; i++) {
    results.set(i, normalizeRow(rawRows[i]));
  }
  
  return results;
}

/**
 * Utility exports for testing individual parsers
 */
export const normalizationUtils = {
  cleanString,
  normalizeMovementType,
  parseQuantity,
  parseUnitCost,
  parseMovementDate,
};
