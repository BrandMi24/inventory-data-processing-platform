/**
 * CSV Parsing Utility
 * Uses PapaParse to parse CSV files into structured data
 */

import Papa from 'papaparse';
import type { RawInventoryRow } from '@/types';

// Expected column headers (case-insensitive matching)
const EXPECTED_HEADERS = [
  'sku',
  'product_name',
  'warehouse',
  'movement_type',
  'quantity',
  'unit_cost',
  'movement_date',
  'reference',
] as const;

// Header aliases to support common variations
const HEADER_ALIASES: Record<string, keyof RawInventoryRow> = {
  'sku': 'sku',
  'product_sku': 'sku',
  'item_sku': 'sku',
  'product_name': 'product_name',
  'productname': 'product_name',
  'name': 'product_name',
  'item_name': 'product_name',
  'warehouse': 'warehouse',
  'warehouse_name': 'warehouse',
  'location': 'warehouse',
  'movement_type': 'movement_type',
  'movementtype': 'movement_type',
  'type': 'movement_type',
  'quantity': 'quantity',
  'qty': 'quantity',
  'amount': 'quantity',
  'unit_cost': 'unit_cost',
  'unitcost': 'unit_cost',
  'cost': 'unit_cost',
  'price': 'unit_cost',
  'unit_price': 'unit_cost',
  'movement_date': 'movement_date',
  'movementdate': 'movement_date',
  'date': 'movement_date',
  'reference': 'reference',
  'ref': 'reference',
  'reference_number': 'reference',
  'po_number': 'reference',
  'so_number': 'reference',
};

interface ParseCsvResult {
  data: RawInventoryRow[];
  errors: string[];
  meta: {
    totalRows: number;
    headers: string[];
    headerMapping: Record<string, string>;
  };
}

/**
 * Maps CSV headers to standardized field names
 */
function mapHeaders(headers: string[]): { 
  mapping: Record<string, keyof RawInventoryRow>; 
  missing: string[];
  unknown: string[];
} {
  const mapping: Record<string, keyof RawInventoryRow> = {};
  const foundFields = new Set<string>();
  const unknown: string[] = [];

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, '_');
    const mappedField = HEADER_ALIASES[normalizedHeader];
    
    if (mappedField) {
      mapping[header] = mappedField;
      foundFields.add(mappedField);
    } else {
      unknown.push(header);
    }
  }

  // Check for missing required fields (all except reference)
  const requiredFields = EXPECTED_HEADERS.filter(h => h !== 'reference');
  const missing = requiredFields.filter(field => !foundFields.has(field));

  return { mapping, missing, unknown };
}

/**
 * Parse a CSV file into RawInventoryRow array
 */
export function parseCsv(file: File): Promise<ParseCsvResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    let headers: string[] = [];
    let headerMapping: Record<string, string> = {};

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        // Get headers from meta
        headers = results.meta.fields || [];
        
        // Map headers to standardized fields
        const { mapping, missing, unknown } = mapHeaders(headers);
        headerMapping = mapping as Record<string, string>;

        // Report parsing errors from PapaParse
        if (results.errors.length > 0) {
          results.errors.forEach((err) => {
            errors.push(`Row ${err.row}: ${err.message}`);
          });
        }

        // Check for missing required columns
        if (missing.length > 0) {
          errors.push(`Missing required columns: ${missing.join(', ')}`);
        }

        // Warn about unknown columns (non-blocking)
        if (unknown.length > 0) {
          console.warn(`Unknown columns will be ignored: ${unknown.join(', ')}`);
        }

        // Transform data to RawInventoryRow format
        const data: RawInventoryRow[] = results.data.map((row) => {
          const transformed: RawInventoryRow = {
            sku: '',
            product_name: '',
            warehouse: '',
            movement_type: '',
            quantity: '',
            unit_cost: '',
            movement_date: '',
            reference: '',
          };

          // Map each column using our header mapping
          for (const [originalHeader, mappedField] of Object.entries(mapping)) {
            const value = row[originalHeader];
            if (value !== undefined) {
              transformed[mappedField] = value;
            }
          }

          return transformed;
        });

        // Filter out completely empty rows
        const filteredData = data.filter(row => 
          Object.values(row).some(value => value && value.trim() !== '')
        );

        resolve({
          data: filteredData,
          errors,
          meta: {
            totalRows: filteredData.length,
            headers,
            headerMapping,
          },
        });
      },
      error: (error) => {
        errors.push(`Parse error: ${error.message}`);
        resolve({
          data: [],
          errors,
          meta: {
            totalRows: 0,
            headers: [],
            headerMapping: {},
          },
        });
      },
    });
  });
}

/**
 * Parse CSV from a string (useful for testing)
 */
export function parseCsvString(csvContent: string): Promise<ParseCsvResult> {
  // Create a File-like object from the string
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const file = new File([blob], 'data.csv', { type: 'text/csv' });
  return parseCsv(file);
}
