/**
 * API Status Diagnostic Panel
 * Shows real-time API connection status and debug info
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { getAuthMode } from '../../lib/auth';

interface ApiStatus {
  productsEndpoint: 'checking' | 'ok' | 'error';
  authToken: string | null;
  authMode: string | null;
  hasCache: boolean;
  lastError: string | null;
}

export function ApiStatusPanel() {
  const [status, setStatus] = useState<ApiStatus>({
    productsEndpoint: 'checking',
    authToken: null,
    authMode: null,
    hasCache: false,
    lastError: null,
  });
  const [testing, setTesting] = useState(false);

  const checkStatus = async () => {
    setTesting(true);
    
    const authToken = localStorage.getItem('authToken');
    const authMode = getAuthMode();
    const hasCache = !!localStorage.getItem('productsConfig');
    
    try {
      await apiClient.getProducts();
      setStatus({
        productsEndpoint: 'ok',
        authToken: authToken ? authToken.substring(0, 20) + '...' : null,
        authMode,
        hasCache,
        lastError: null,
      });
    } catch (error) {
      setStatus({
        productsEndpoint: 'error',
        authToken: authToken ? authToken.substring(0, 20) + '...' : null,
        authMode,
        hasCache,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-slate-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">API Diagnostics</h3>
        <button
          onClick={checkStatus}
          disabled={testing}
          className="p-1 hover:bg-slate-100 rounded"
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {/* Products Endpoint */}
        <div className="flex items-center gap-2">
          {status.productsEndpoint === 'checking' && (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          {status.productsEndpoint === 'ok' && (
            <CheckCircle className="w-4 h-4 text-green-600" />
          )}
          {status.productsEndpoint === 'error' && (
            <XCircle className="w-4 h-4 text-red-600" />
          )}
          <span className="font-medium">Products API:</span>
          <span className={
            status.productsEndpoint === 'ok' ? 'text-green-600' :
            status.productsEndpoint === 'error' ? 'text-red-600' :
            'text-amber-600'
          }>
            {status.productsEndpoint === 'ok' ? 'Connected' :
             status.productsEndpoint === 'error' ? 'Failed' :
             'Checking...'}
          </span>
        </div>

        {/* Auth Mode */}
        <div className="flex items-start gap-2">
          <span className="font-medium">Auth Mode:</span>
          <span className="text-slate-600">
            {status.authMode || 'Not authenticated'}
          </span>
        </div>

        {/* Auth Token */}
        {status.authToken && (
          <div className="flex items-start gap-2">
            <span className="font-medium">Token:</span>
            <span className="text-slate-600 font-mono text-xs break-all">
              {status.authToken}
            </span>
          </div>
        )}

        {/* Cache Status */}
        <div className="flex items-center gap-2">
          {status.hasCache ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-medium">Cache:</span>
          <span className="text-slate-600">
            {status.hasCache ? 'Available' : 'Empty'}
          </span>
        </div>

        {/* Error Message */}
        {status.lastError && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="font-medium text-red-600 mb-1">Error:</div>
            <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
              {status.lastError}
            </div>
          </div>
        )}

        {/* API Endpoint */}
        <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
          <div className="font-medium mb-1">Endpoint:</div>
          <div className="font-mono break-all">
            https://otsukadetailer.site/api/products
          </div>
        </div>
      </div>
    </div>
  );
}
