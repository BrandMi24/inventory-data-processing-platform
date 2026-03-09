/**
 * Excel Parsing Utility
 * Uses SheetJS (xlsx) to parse Excel files into structured data
 */

import * as XLSX from 'xlsx';
import type { RawInventoryRow } from '@/types';

// Header aliases to support common variations (same as CSV)
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

interface ParseExcelResult {
  data: RawInventoryRow[];
  errors: string[];
  meta: {
    totalRows: number;
    headers: string[];
    headerMapping: Record<string, string>;
    sheetName: string;
    totalSheets: number;
  };
}

/**
 * Maps Excel headers to standardized field names
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
    const normalizedHeader = String(header).toLowerCase().trim().replace(/\s+/g, '_');
    const mappedField = HEADER_ALIASES[normalizedHeader];
    
    if (mappedField) {
      mapping[header] = mappedField;
      foundFields.add(mappedField);
    } else {
      unknown.push(String(header));
    }
  }

  // Check for missing required fields (all except reference)
  const requiredFields = ['sku', 'product_name', 'warehouse', 'movement_type', 'quantity', 'unit_cost', 'movement_date'];
  const missing = requiredFields.filter(field => !foundFields.has(field));

  return { mapping, missing, unknown };
}

/**
 * Convert Excel serial date to ISO date string
 * Excel stores dates as numbers (days since 1900-01-01)
 */
function excelDateToIso(excelDate: number | string | Date): string {
  // If already a string, return as-is
  if (typeof excelDate === 'string') {
    return excelDate;
  }

  // If it's a Date object, convert to ISO
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }

  // If it's a number (Excel serial date), convert it
  if (typeof excelDate === 'number') {
    // SheetJS provides a utility for this
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return String(excelDate);
}

/**
 * Parse an Excel file into RawInventoryRow array
 * Reads the first sheet by default
 */
export function parseExcel(file: File, sheetIndex = 0): Promise<ParseExcelResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true, // Parse dates as Date objects
          cellNF: false,
          cellText: false,
        });

        const sheetNames = workbook.SheetNames;
        
        if (sheetNames.length === 0) {
          errors.push('Excel file contains no sheets');
          resolve({
            data: [],
            errors,
            meta: {
              totalRows: 0,
              headers: [],
              headerMapping: {},
              sheetName: '',
              totalSheets: 0,
            },
          });
          return;
        }

        // Get the target sheet
        const actualIndex = Math.min(sheetIndex, sheetNames.length - 1);
        const sheetName = sheetNames[actualIndex];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (array of objects)
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          raw: false, // Convert values to strings
          defval: '', // Default empty cells to empty string
        });

        if (jsonData.length === 0) {
          errors.push('Sheet is empty or has no data rows');
          resolve({
            data: [],
            errors,
            meta: {
              totalRows: 0,
              headers: [],
              headerMapping: {},
              sheetName,
              totalSheets: sheetNames.length,
            },
          });
          return;
        }

        // Extract headers from first row keys
        const headers = Object.keys(jsonData[0] || {});
        
        // Map headers to standardized fields
        const { mapping, missing, unknown } = mapHeaders(headers);
        const headerMapping = mapping as Record<string, string>;

        // Check for missing required columns
        if (missing.length > 0) {
          errors.push(`Missing required columns: ${missing.join(', ')}`);
        }

        // Warn about unknown columns
        if (unknown.length > 0) {
          console.warn(`Unknown columns will be ignored: ${unknown.join(', ')}`);
        }

        // Transform data to RawInventoryRow format
        const transformedData: RawInventoryRow[] = jsonData.map((row) => {
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
            let value = row[originalHeader];
            
            if (value !== undefined && value !== null) {
              // Special handling for dates
              if (mappedField === 'movement_date') {
                value = excelDateToIso(value as string | number | Date);
              }
              
              transformed[mappedField] = String(value);
            }
          }

          return transformed;
        });

        // Filter out completely empty rows
        const filteredData = transformedData.filter(row => 
          Object.values(row).some(value => value && String(value).trim() !== '')
        );

        resolve({
          data: filteredData,
          errors,
          meta: {
            totalRows: filteredData.length,
            headers,
            headerMapping,
            sheetName,
            totalSheets: sheetNames.length,
          },
        });
      } catch (err) {
        errors.push(`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        resolve({
          data: [],
          errors,
          meta: {
            totalRows: 0,
            headers: [],
            headerMapping: {},
            sheetName: '',
            totalSheets: 0,
          },
        });
      }
    };

    reader.onerror = () => {
      errors.push('Failed to read file');
      resolve({
        data: [],
        errors,
        meta: {
          totalRows: 0,
          headers: [],
          headerMapping: {},
          sheetName: '',
          totalSheets: 0,
        },
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get sheet names from an Excel file without fully parsing it
 */
export function getExcelSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          bookSheets: true, // Only read sheet names
        });
        resolve(workbook.SheetNames);
      } catch {
        resolve([]);
      }
    };

    reader.onerror = () => resolve([]);
    reader.readAsArrayBuffer(file);
  });
}
