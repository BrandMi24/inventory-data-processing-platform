import { useState, useCallback } from 'react';
import { parseCsv } from '@/utils/parseCsv';
import { parseExcel } from '@/utils/parseExcel';
import { validateRows } from '@/utils/validateRows';
import { uploadInventoryFile } from '@/services';
import type { ParsedInventoryRow, ProcessBatchResult } from '@/types';

export type UploadStage = 
  | 'idle' 
  | 'parsing' 
  | 'validating' 
  | 'preview' 
  | 'uploading' 
  | 'complete' 
  | 'error';

interface UseFileUploadReturn {
  stage: UploadStage;
  file: File | null;
  parsedRows: ParsedInventoryRow[];
  parseErrors: string[];
  uploadError: string | null;
  batchId: string | null;
  processResult: ProcessBatchResult | null;
  processFile: (file: File) => Promise<void>;
  confirmUpload: () => Promise<void>;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [stage, setStage] = useState<UploadStage>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessBatchResult | null>(null);

  const getFileType = useCallback((fileName: string): 'csv' | 'xlsx' | 'xls' | null => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'xls') return 'xls';
    return null;
  }, []);

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
      let rawRows;
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
        setUploadError('No data rows found in file.');
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
  }, [getFileType]);

  const confirmUpload = useCallback(async () => {
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
      setProcessResult(result.processResult);
      setStage('complete');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload');
      setStage('error');
    }
  }, [file, parsedRows, getFileType]);

  const reset = useCallback(() => {
    setStage('idle');
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setUploadError(null);
    setBatchId(null);
    setProcessResult(null);
  }, []);

  return {
    stage,
    file,
    parsedRows,
    parseErrors,
    uploadError,
    batchId,
    processResult,
    processFile,
    confirmUpload,
    reset,
  };
}
