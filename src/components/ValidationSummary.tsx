import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatNumber } from '@/utils';

interface ValidationSummaryProps {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validPercentage: number;
    topErrors: [string, number][];
  };
}

export default function ValidationSummary({ summary }: ValidationSummaryProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900">Validation Summary</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-3 gap-6">
          {/* Total Rows */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{formatNumber(summary.total)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Rows</p>
          </div>

          {/* Valid Rows */}
          <div className="text-center p-4 bg-success-50 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6 text-success-600" />
              <p className="text-3xl font-bold text-success-700">{formatNumber(summary.valid)}</p>
            </div>
            <p className="text-sm text-success-600 mt-1">Valid Rows</p>
          </div>

          {/* Invalid Rows */}
          <div className="text-center p-4 bg-danger-50 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <XCircle className="w-6 h-6 text-danger-600" />
              <p className="text-3xl font-bold text-danger-700">{formatNumber(summary.invalid)}</p>
            </div>
            <p className="text-sm text-danger-600 mt-1">Invalid Rows</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Validation Progress</span>
            <span className="font-medium text-gray-900">{summary.validPercentage}% valid</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-success-500 rounded-full transition-all duration-500"
              style={{ width: `${summary.validPercentage}%` }}
            />
          </div>
        </div>

        {/* Top Errors */}
        {summary.topErrors.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-warning-600" />
              <h4 className="font-medium text-gray-900">Common Errors</h4>
            </div>
            <div className="space-y-2">
              {summary.topErrors.map(([error, count], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-warning-50 rounded-lg text-sm"
                >
                  <span className="text-warning-800">{error}</span>
                  <span className="font-medium text-warning-700">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
