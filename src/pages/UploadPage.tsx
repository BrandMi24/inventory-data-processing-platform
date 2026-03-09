import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { parseCsv } from '@/utils/parseCsv';
import { parseExcel } from '@/utils/parseExcel';
import { validateRows, getValidationSummary } from '@/utils/validateRows';
import { uploadInventoryFile } from '@/services';
import type { ParsedInventoryRow, RawInventoryRow } from '@/types';
import { formatNumber, classNames } from '@/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DataPreviewTable from '@/components/DataPreviewTable';
import ValidationSummary from '@/components/ValidationSummary';

type UploadStage = 'idle' | 'parsing' | 'validating' | 'preview' | 'uploading' | 'complete' | 'error';

export default function UploadPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<UploadStage>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const getFileType = (fileName: string): 'csv' | 'xlsx' | 'xls' | null => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'xls') return 'xls';
    return null;
  };

  const processFile = useCallback(async (selectedFile: File) => {
    const fileType = getFileType(selectedFile.name);
    
    if (!fileType) {
      setUploadError('Invalid file type. Please upload a CSV or Excel file.');
      setStage('error');
      return;
    }

    setFile(selectedFile);
    setStage('parsing');
    setUploadError(null);
    setParseErrors([]);

    try {
      // Parse file based on type
      let rawRows: RawInventoryRow[] = [];
      let errors: string[] = [];

      if (fileType === 'csv') {
        const result = await parseCsv(selectedFile);
        rawRows = result.data;
        errors = result.errors;
      } else {
        const result = await parseExcel(selectedFile);
        rawRows = result.data;
        errors = result.errors;
      }

      if (errors.length > 0) {
        setParseErrors(errors);
      }

      if (rawRows.length === 0) {
        setUploadError('No data rows found in file. Please check the file format.');
        setStage('error');
        return;
      }

      // Validate rows
      setStage('validating');
      const validated = validateRows(rawRows);
      setParsedRows(validated);
      setStage('preview');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to process file');
      setStage('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleConfirmUpload = async () => {
    if (!file || parsedRows.length === 0) return;

    const fileType = getFileType(file.name);
    if (!fileType) return;

    setStage('uploading');
    setUploadError(null);

    try {
      const result = await uploadInventoryFile(file.name, fileType, parsedRows);

      if (result.error) {
        setUploadError(result.error);
        setStage('error');
        return;
      }

      setBatchId(result.batchId);
      setStage('complete');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload');
      setStage('error');
    }
  };

  const handleReset = () => {
    setStage('idle');
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setUploadError(null);
    setBatchId(null);
  };

  const summary = parsedRows.length > 0 ? getValidationSummary(parsedRows) : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Inventory File</h1>
        <p className="text-gray-600 mt-1">
          Upload a CSV or Excel file with inventory movement data
        </p>
      </div>

      {/* Upload Area */}
      {stage === 'idle' && (
        <div
          className={classNames(
            'relative border-2 border-dashed rounded-xl p-12 text-center transition-colors',
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full">
              <Upload className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Drop your file here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports CSV and Excel files (.csv, .xlsx, .xls)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing States */}
      {(stage === 'parsing' || stage === 'validating') && (
        <div className="card p-12 text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-lg font-medium text-gray-900">
            {stage === 'parsing' ? 'Parsing file...' : 'Validating data...'}
          </p>
          <p className="text-sm text-gray-500 mt-1">{file?.name}</p>
        </div>
      )}

      {/* Preview Stage */}
      {stage === 'preview' && file && summary && (
        <div className="space-y-6">
          {/* File Info */}
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-10 h-10 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {formatNumber(summary.total)} rows • {summary.validPercentage}% valid
                </p>
              </div>
            </div>
            <button onClick={handleReset} className="btn-secondary">
              Choose Different File
            </button>
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="alert-warning">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Parse warnings</p>
                  <ul className="text-sm mt-1 list-disc list-inside">
                    {parseErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>...and {parseErrors.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Validation Summary */}
          <ValidationSummary summary={summary} />

          {/* Data Preview */}
          <DataPreviewTable rows={parsedRows} />

          {/* Actions */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              {summary.valid} valid rows will be processed. {summary.invalid} invalid rows will be stored for review.
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="btn-primary"
                disabled={summary.valid === 0}
              >
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {stage === 'uploading' && (
        <div className="card p-12 text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-lg font-medium text-gray-900">Uploading and processing...</p>
          <p className="text-sm text-gray-500 mt-1">
            This may take a moment for large files
          </p>
        </div>
      )}

      {/* Complete State */}
      {stage === 'complete' && (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-success-100 rounded-full mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success-600" />
          </div>
          <p className="text-lg font-medium text-gray-900">Upload Complete!</p>
          <p className="text-sm text-gray-500 mt-1">
            Your inventory data has been processed successfully.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={handleReset} className="btn-secondary">
              Upload Another File
            </button>
            <button
              onClick={() => navigate('/batches')}
              className="btn-primary"
            >
              View Batches
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {stage === 'error' && (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-danger-100 rounded-full mx-auto mb-4">
            <XCircle className="w-8 h-8 text-danger-600" />
          </div>
          <p className="text-lg font-medium text-gray-900">Upload Failed</p>
          <p className="text-sm text-danger-600 mt-1">{uploadError}</p>
          <button onClick={handleReset} className="btn-primary mt-6">
            Try Again
          </button>
        </div>
      )}

      {/* File Format Help */}
      {stage === 'idle' && (
        <div className="mt-8 card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Expected File Format</h3>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-gray-500">sku,product_name,warehouse,movement_type,quantity,unit_cost,movement_date,reference</div>
            <div className="text-gray-700 mt-1">A100,Oil Filter,Main Warehouse,IN,50,120.50,2025-03-01,PO-1001</div>
            <div className="text-gray-700">A100,Oil Filter,Main Warehouse,OUT,10,120.50,2025-03-02,SO-2001</div>
            <div className="text-gray-700">B200,Spark Plug,Main Warehouse,IN,100,35.00,2025-03-01,PO-1002</div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            All columns except <code className="bg-gray-100 px-1 rounded">reference</code> are required.
            Movement type must be <code className="bg-gray-100 px-1 rounded">IN</code> or <code className="bg-gray-100 px-1 rounded">OUT</code>.
          </p>
        </div>
      )}
    </div>
  );
}
