import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import type { ParsedInventoryRow } from '@/types';
import { classNames } from '@/utils';

interface DataPreviewTableProps {
  rows: ParsedInventoryRow[];
  maxRows?: number;
}

export default function DataPreviewTable({ rows, maxRows = 50 }: DataPreviewTableProps) {
  const [showInvalid, setShowInvalid] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filter and limit rows
  const displayRows = rows
    .filter((row) => (showInvalid ? true : row.isValid))
    .slice(0, maxRows);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Data Preview</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInvalid}
            onChange={(e) => setShowInvalid(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Show invalid rows
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-16">#</th>
              <th className="w-16">Status</th>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Warehouse</th>
              <th>Type</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Cost</th>
              <th>Date</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <>
                <tr
                  key={row.rowNumber}
                  className={classNames(
                    'cursor-pointer',
                    !row.isValid && 'bg-danger-50'
                  )}
                  onClick={() =>
                    setExpandedRow(expandedRow === row.rowNumber ? null : row.rowNumber)
                  }
                >
                  <td className="font-mono text-gray-500">{row.rowNumber}</td>
                  <td>
                    {row.isValid ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-danger-500" />
                    )}
                  </td>
                  <td className="font-medium">{row.raw.sku || '-'}</td>
                  <td className="max-w-[200px] truncate">{row.raw.product_name || '-'}</td>
                  <td>{row.raw.warehouse || '-'}</td>
                  <td>
                    <span
                      className={classNames(
                        'badge',
                        row.raw.movement_type?.toUpperCase() === 'IN'
                          ? 'badge-success'
                          : row.raw.movement_type?.toUpperCase() === 'OUT'
                          ? 'badge-danger'
                          : 'badge-gray'
                      )}
                    >
                      {row.raw.movement_type || '-'}
                    </span>
                  </td>
                  <td className="text-right font-mono">{row.raw.quantity || '-'}</td>
                  <td className="text-right font-mono">{row.raw.unit_cost || '-'}</td>
                  <td>{row.raw.movement_date || '-'}</td>
                  <td className="max-w-[100px] truncate">{row.raw.reference || '-'}</td>
                </tr>
                {/* Expanded Error Details */}
                {expandedRow === row.rowNumber && row.errors.length > 0 && (
                  <tr>
                    <td colSpan={10} className="bg-danger-50 px-6 py-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-danger-700">Validation Errors:</p>
                          <ul className="text-sm text-danger-600 list-disc list-inside mt-1">
                            {row.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > maxRows && (
        <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-200">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
