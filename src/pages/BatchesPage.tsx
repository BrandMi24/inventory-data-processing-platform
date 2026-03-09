import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, RefreshCw, ExternalLink } from 'lucide-react';
import { getUploadBatches } from '@/services';
import type { UploadBatch } from '@/types';
import { formatDateTime, formatNumber, classNames } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function BatchesPage() {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);

    const result = await getUploadBatches(100);
    
    if (result.error) {
      setError(result.error);
    } else {
      setBatches(result.data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const getStatusBadge = (status: UploadBatch['status']) => {
    const styles = {
      completed: 'badge-success',
      processing: 'badge-info',
      pending: 'badge-warning',
      failed: 'badge-danger',
    };
    return styles[status] || 'badge-gray';
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
          <h1 className="text-2xl font-bold text-gray-900">Upload Batches</h1>
          <p className="text-gray-600 mt-1">
            View and manage uploaded inventory files
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBatches} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <Link to="/upload" className="btn-primary">
            Upload New File
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error mb-6">
          <p>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {batches.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No upload batches yet</p>
            <Link to="/upload" className="btn-primary mt-4">
              Upload Your First File
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Valid</th>
                  <th className="text-right">Invalid</th>
                  <th className="text-right">Processed</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-gray-400" />
                        <span className="font-medium max-w-[250px] truncate">
                          {batch.file_name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray uppercase">{batch.file_type}</span>
                    </td>
                    <td>
                      <span className={classNames('badge', getStatusBadge(batch.status))}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="text-right font-mono">{formatNumber(batch.total_rows)}</td>
                    <td className="text-right font-mono text-success-600">
                      {formatNumber(batch.valid_rows)}
                    </td>
                    <td className="text-right font-mono text-danger-600">
                      {formatNumber(batch.invalid_rows)}
                    </td>
                    <td className="text-right font-mono">{formatNumber(batch.processed_rows)}</td>
                    <td className="text-gray-500">{formatDateTime(batch.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {batches.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-900">{formatNumber(batches.length)}</p>
            <p className="text-sm text-gray-500">Total Batches</p>
          </div>
          <div className="p-4 bg-success-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-success-700">
              {formatNumber(batches.reduce((sum, b) => sum + b.valid_rows, 0))}
            </p>
            <p className="text-sm text-success-600">Total Valid Rows</p>
          </div>
          <div className="p-4 bg-danger-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-danger-700">
              {formatNumber(batches.reduce((sum, b) => sum + b.invalid_rows, 0))}
            </p>
            <p className="text-sm text-danger-600">Total Invalid Rows</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">
              {formatNumber(batches.filter((b) => b.status === 'completed').length)}
            </p>
            <p className="text-sm text-blue-600">Completed</p>
          </div>
        </div>
      )}
    </div>
  );
}
