import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Package, Search } from 'lucide-react';
import { getInventorySummary, getLowStockProducts } from '@/services';
import type { InventorySummaryItem, LowStockProduct } from '@/types';
import { formatCurrency, formatNumber, formatDate, classNames } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type ViewMode = 'all' | 'low-stock';

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [allProducts, setAllProducts] = useState<InventorySummaryItem[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryResult, lowStockResult] = await Promise.all([
        getInventorySummary(),
        getLowStockProducts(),
      ]);

      if (summaryResult.error) throw new Error(summaryResult.error);
      if (lowStockResult.error) throw new Error(lowStockResult.error);

      setAllProducts(summaryResult.data);
      setLowStock(lowStockResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter products by search term
  const filteredProducts = allProducts.filter(
    (p) =>
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayProducts = viewMode === 'low-stock' 
    ? filteredProducts.filter(p => p.is_low_stock)
    : filteredProducts;

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
          <h1 className="text-2xl font-bold text-gray-900">Inventory Summary</h1>
          <p className="text-gray-600 mt-1">
            Current stock levels and movement summary by product
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

      {/* View Mode Toggle & Search */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              viewMode === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            All Products ({allProducts.length})
          </button>
          <button
            onClick={() => setViewMode('low-stock')}
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
              viewMode === 'low-stock'
                ? 'bg-warning-100 text-warning-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Low Stock ({lowStock.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {displayProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm ? 'No products match your search' : 'No inventory data available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th className="text-right">Min Stock</th>
                  <th className="text-right">Total IN</th>
                  <th className="text-right">Total OUT</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Total Value</th>
                  <th>Last Movement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((product) => (
                  <tr
                    key={product.product_id}
                    className={classNames(product.is_low_stock && 'bg-warning-50')}
                  >
                    <td className="font-mono font-medium">{product.sku}</td>
                    <td className="max-w-[250px] truncate">{product.product_name}</td>
                    <td className="text-right font-mono text-gray-500">
                      {formatNumber(product.min_stock)}
                    </td>
                    <td className="text-right font-mono text-success-600">
                      +{formatNumber(product.total_in)}
                    </td>
                    <td className="text-right font-mono text-danger-600">
                      -{formatNumber(product.total_out)}
                    </td>
                    <td className="text-right">
                      <span
                        className={classNames(
                          'font-mono font-bold',
                          product.is_low_stock ? 'text-warning-700' : 'text-gray-900'
                        )}
                      >
                        {formatNumber(product.current_stock)}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {formatCurrency(product.total_value)}
                    </td>
                    <td className="text-gray-500">
                      {formatDate(product.last_movement_date)}
                    </td>
                    <td>
                      {product.is_low_stock ? (
                        <span className="badge badge-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="badge badge-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {allProducts.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(allProducts.length)}
            </p>
            <p className="text-sm text-gray-500">Total SKUs</p>
          </div>
          <div className="p-4 bg-success-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-success-700">
              {formatNumber(allProducts.reduce((sum, p) => sum + p.total_in, 0))}
            </p>
            <p className="text-sm text-success-600">Total Units IN</p>
          </div>
          <div className="p-4 bg-danger-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-danger-700">
              {formatNumber(allProducts.reduce((sum, p) => sum + p.total_out, 0))}
            </p>
            <p className="text-sm text-danger-600">Total Units OUT</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(allProducts.reduce((sum, p) => sum + p.total_value, 0))}
            </p>
            <p className="text-sm text-blue-600">Total Inventory Value</p>
          </div>
        </div>
      )}
    </div>
  );
}
