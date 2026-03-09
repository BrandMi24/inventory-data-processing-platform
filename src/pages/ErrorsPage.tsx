import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, FileSpreadsheet, Search } from 'lucide-react';
import { getInvalidRows, getUploadBatches } from '@/services';
import type { StagingInventoryRow, UploadBatch } from '@/types';
import { formatDateTime, classNames } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ErrorsPage() {
  const [invalidRows, setInvalidRows] = useState<StagingInventoryRow[]>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [rowsResult, batchesResult] = await Promise.all([
        getInvalidRows(selectedBatch === 'all' ? undefined : selectedBatch),
        getUploadBatches(),
      ]);

      if (rowsResult.error) throw new Error(rowsResult.error);
      if (batchesResult.error) throw new Error(batchesResult.error);

      setInvalidRows(rowsResult.data);
      setBatches(batchesResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatch]);

  // Get batch name by ID
  const getBatchName = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    return batch?.file_name || batchId.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invalid Rows</h1>
          <p className="text-gray-600 mt-1">
            Review and diagnose rows that failed validation
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error mb-6">
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by batch:</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="input w-64"
          >
            <option value="all">All Batches</option>
            {batches
              .filter((b) => b.invalid_rows > 0)
              .map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.file_name} ({batch.invalid_rows} errors)
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {invalidRows.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No invalid rows found</p>
            <p className="text-sm text-gray-500 mt-1">
              All your uploaded data has passed validation
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-16">Row #</th>
                  <th>Batch</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Date</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {invalidRows.map((row) => (
                  <>
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-danger-50"
                      onClick={() =>
                        setExpandedRow(expandedRow === row.id ? null : row.id)
                      }
                    >
                      <td className="font-mono text-gray-500">{row.row_number}</td>
                      <td>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[150px] block">
                          {getBatchName(row.batch_id)}
                        </span>
                      </td>
                      <td className="font-mono">
                        {row.raw_product_sku || <span className="text-danger-500">empty</span>}
                      </td>
                      <td className="max-w-[150px] truncate">
                        {row.raw_product_name || <span className="text-danger-500">empty</span>}
                      </td>
                      <td>
                        {row.raw_warehouse || <span className="text-danger-500">empty</span>}
                      </td>
                      <td>
                        {row.raw_movement_type ? (
                          <span
                            className={classNames(
                              'badge',
                              ['IN', 'in'].includes(row.raw_movement_type)
                                ? 'badge-success'
                                : ['OUT', 'out'].includes(row.raw_movement_type)
                                ? 'badge-danger'
                                : 'badge-warning'
                            )}
                          >
                            {row.raw_movement_type}
                          </span>
                        ) : (
                          <span className="text-danger-500">empty</span>
                        )}
                      </td>
                      <td className="font-mono">
                        {row.raw_quantity || <span className="text-danger-500">-</span>}
                      </td>
                      <td>{row.raw_movement_date || '-'}</td>
                      <td className="max-w-[200px]">
                        <span className="text-danger-600 text-sm truncate block">
                          {row.error_message?.split(';')[0] || 'Unknown error'}
                        </span>
                      </td>
                    </tr>
                    {/* Expanded Error Details */}
                    {expandedRow === row.id && (
                      <tr>
                        <td colSpan={9} className="bg-danger-50 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Raw Data</h4>
                              <dl className="text-sm space-y-1">
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">SKU:</dt>
                                  <dd className="font-mono">{row.raw_product_sku || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Product:</dt>
                                  <dd>{row.raw_product_name || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Warehouse:</dt>
                                  <dd>{row.raw_warehouse || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Type:</dt>
                                  <dd>{row.raw_movement_type || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Quantity:</dt>
                                  <dd className="font-mono">{row.raw_quantity || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Unit Cost:</dt>
                                  <dd className="font-mono">{row.raw_unit_cost || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Date:</dt>
                                  <dd>{row.raw_movement_date || '-'}</dd>
                                </div>
                                <div className="flex">
                                  <dt className="w-24 text-gray-500">Reference:</dt>
                                  <dd>{row.raw_reference || '-'}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <h4 className="font-medium text-danger-700 mb-2">Error Details</h4>
                              <ul className="text-sm text-danger-600 list-disc list-inside space-y-1">
                                {row.error_message?.split(';').map((err, i) => (
                                  <li key={i}>{err.trim()}</li>
                                ))}
                              </ul>
                              <p className="text-xs text-gray-500 mt-4">
                                Created: {formatDateTime(row.created_at)}
                              </p>
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
        )}
      </div>

      {/* Summary */}
      {invalidRows.length > 0 && (
        <div className="mt-6 p-4 bg-danger-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-600" />
              <span className="font-medium text-danger-700">
                {invalidRows.length} invalid rows require attention
              </span>
            </div>
            <p className="text-sm text-danger-600">
              Click on a row to see full details and error information
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
