import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Warehouse,
  FileUp,
  ArrowDownUp,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { getDashboardMetrics, getLowStockProducts, getUploadBatches } from '@/services';
import type { DashboardMetrics, LowStockProduct, UploadBatch } from '@/types';
import { formatCurrency, formatNumber, formatDateTime, classNames } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatsCard from '@/components/ui/StatsCard';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [recentBatches, setRecentBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [metricsResult, lowStockResult, batchesResult] = await Promise.all([
          getDashboardMetrics(),
          getLowStockProducts(),
          getUploadBatches(5),
        ]);

        if (metricsResult.error) throw new Error(metricsResult.error);
        if (lowStockResult.error) throw new Error(lowStockResult.error);
        if (batchesResult.error) throw new Error(batchesResult.error);

        setMetrics(metricsResult.data);
        setLowStock(lowStockResult.data);
        setRecentBatches(batchesResult.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="alert-error">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your inventory data processing system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Products"
          value={formatNumber(metrics?.total_products ?? 0)}
          icon={Package}
          color="blue"
        />
        <StatsCard
          title="Warehouses"
          value={formatNumber(metrics?.total_warehouses ?? 0)}
          icon={Warehouse}
          color="green"
        />
        <StatsCard
          title="Upload Batches"
          value={formatNumber(metrics?.total_batches ?? 0)}
          icon={FileUp}
          color="purple"
        />
        <StatsCard
          title="Total Movements"
          value={formatNumber(metrics?.total_movements ?? 0)}
          icon={ArrowDownUp}
          color="orange"
        />
      </div>

      {/* Value Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-success-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total IN Value</p>
              <p className="text-xl font-bold text-success-600">
                {formatCurrency(metrics?.total_in_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-danger-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-danger-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total OUT Value</p>
              <p className="text-xl font-bold text-danger-600">
                {formatCurrency(metrics?.total_out_value ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-warning-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock Products</p>
              <p className="text-xl font-bold text-warning-600">
                {formatNumber(metrics?.low_stock_count ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
            <Link to="/inventory" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </Link>
          </div>
          <div className="card-body">
            {lowStock.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No low stock alerts</p>
            ) : (
              <div className="space-y-3">
                {lowStock.slice(0, 5).map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-3 bg-warning-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.sku}</p>
                      <p className="text-sm text-gray-600">{item.product_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-warning-700">
                        Stock: {formatNumber(item.current_stock)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Min: {formatNumber(item.min_stock)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Batches */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Uploads</h2>
            <Link to="/batches" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </Link>
          </div>
          <div className="card-body">
            {recentBatches.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent uploads</p>
            ) : (
              <div className="space-y-3">
                {recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg border border-gray-200">
                        <Clock className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">
                          {batch.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(batch.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={classNames(
                          'badge',
                          batch.status === 'completed' && 'badge-success',
                          batch.status === 'processing' && 'badge-info',
                          batch.status === 'pending' && 'badge-warning',
                          batch.status === 'failed' && 'badge-danger'
                        )}
                      >
                        {batch.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {batch.valid_rows}/{batch.total_rows} valid
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 p-6 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Ready to upload?</h3>
            <p className="text-primary-100 mt-1">
              Upload CSV or Excel files to process inventory movements
            </p>
          </div>
          <Link
            to="/upload"
            className="btn bg-white text-primary-700 hover:bg-primary-50"
          >
            Upload File
          </Link>
        </div>
      </div>
    </div>
  );
}
