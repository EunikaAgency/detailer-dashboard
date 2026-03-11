/**
 * Diagnostics Screen
 * Shows detailed API and data fetching diagnostics
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { StickyHeader } from '../components/ui/sticky-header';
import { Card } from '../components/ui/card';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { apiClient, API_BASE_URL, CONFIG_BASE_URL, getApiKey } from '../lib/api';
import { getAuthMode, getAccountProfile } from '../lib/auth';
import {
  clearMediaCache,
  clearPresentationCache,
  getMediaCacheEntryCount,
  getOfflinePresentationSummary,
  getPresentationCacheEntryCount,
} from '../lib/media-cache';
import { getCachedProducts } from '../lib/products';

export default function Diagnostics() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [mediaCacheEntries, setMediaCacheEntries] = useState(0);
  const [presentationCacheEntries, setPresentationCacheEntries] = useState(0);
  const [apiTest, setApiTest] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    response?: any;
  }>({ status: 'idle', message: 'Click "Test API" to check connection' });

  const authToken = localStorage.getItem('authToken');
  const authMode = getAuthMode();
  const accountProfile = getAccountProfile();
  const cachedProducts = getCachedProducts();
  const productsCacheRaw = localStorage.getItem('productsConfig');
  const apiKey = getApiKey();
  const offlineSummary = getOfflinePresentationSummary();

  useEffect(() => {
    void getMediaCacheEntryCount().then(setMediaCacheEntries);
    void getPresentationCacheEntryCount().then(setPresentationCacheEntries);
  }, []);

  const testApi = async () => {
    setTesting(true);
    setApiTest({ status: 'testing', message: 'Testing API connection...' });

    try {
      const response = await apiClient.getProducts();
      setApiTest({
        status: 'success',
        message: `✅ Success! Fetched ${response.products.length} products (version ${response.version})`,
        response,
      });
    } catch (error) {
      setApiTest({
        status: 'error',
        message: `❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Diagnostics" showBack backTo="/settings/advanced" />

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">
        {/* API Test */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">API Connection Test</h2>
            <button
              onClick={testApi}
              disabled={testing}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              Test API
            </button>
          </div>

          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            apiTest.status === 'success' ? 'bg-green-50 border border-green-200' :
            apiTest.status === 'error' ? 'bg-red-50 border border-red-200' :
            apiTest.status === 'testing' ? 'bg-blue-50 border border-blue-200' :
            'bg-slate-50 border border-slate-200'
          }`}>
            {apiTest.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
            {apiTest.status === 'error' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
            {apiTest.status === 'testing' && <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 animate-spin" />}
            {apiTest.status === 'idle' && <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />}
            
            <div className="flex-1">
              <p className={`text-sm ${
                apiTest.status === 'success' ? 'text-green-700' :
                apiTest.status === 'error' ? 'text-red-700' :
                apiTest.status === 'testing' ? 'text-blue-700' :
                'text-slate-600'
              }`}>
                {apiTest.message}
              </p>

              {apiTest.response && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                    View Response
                  </summary>
                  <pre className="mt-2 p-3 bg-white rounded text-xs overflow-x-auto">
                    {JSON.stringify(apiTest.response, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </Card>

        {/* Authentication Status */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Authentication Status</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {authToken ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span className="font-medium">Authenticated:</span>
              <span className={authToken ? 'text-green-600' : 'text-red-600'}>
                {authToken ? 'Yes' : 'No'}
              </span>
            </div>

            {authMode && (
              <div className="flex items-start gap-2">
                <span className="font-medium">Auth Mode:</span>
                <span className="text-slate-600">{authMode}</span>
              </div>
            )}

            {authToken && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Auth Token:</span>
                  <button
                    onClick={() => copyToClipboard(authToken)}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2 bg-slate-100 rounded font-mono text-xs break-all">
                  {authToken}
                </div>
              </div>
            )}

            {accountProfile && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="font-medium mb-2">Account Profile:</div>
                <pre className="p-3 bg-slate-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(accountProfile, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* Cache Status */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Cache Status</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {cachedProducts ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium">Products Cache:</span>
              <span className={cachedProducts ? 'text-green-600' : 'text-slate-500'}>
                {cachedProducts ? `${cachedProducts.length} products cached` : 'Empty'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {mediaCacheEntries > 0 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium">Media Cache:</span>
              <span className={mediaCacheEntries > 0 ? 'text-green-600' : 'text-slate-500'}>
                {mediaCacheEntries > 0 ? `${mediaCacheEntries} images retained` : 'Empty'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {presentationCacheEntries > 0 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium">Presentation Cache:</span>
              <span className={presentationCacheEntries > 0 ? 'text-green-600' : 'text-slate-500'}>
                {presentationCacheEntries > 0 ? `${presentationCacheEntries} deck assets retained` : 'Empty'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {offlineSummary.downloadedProducts > 0 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-medium">Offline Library:</span>
              <span className={offlineSummary.downloadedProducts > 0 ? 'text-green-600' : 'text-slate-500'}>
                {offlineSummary.downloadedProducts > 0
                  ? `${offlineSummary.downloadedProducts} presentations, ${offlineSummary.downloadedDecks} cases`
                  : 'Empty'}
              </span>
            </div>

            {productsCacheRaw && (
              <div className="mt-3">
                <div className="font-medium mb-2">Cache Data:</div>
                <pre className="p-3 bg-slate-100 rounded text-xs overflow-x-auto max-h-64">
                  {productsCacheRaw}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* API Endpoint Info */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">API Configuration</h2>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Base URL:</span>
              <div className="mt-1 p-2 bg-slate-100 rounded font-mono text-xs">
                {API_BASE_URL}
              </div>
            </div>

            <div>
              <span className="font-medium">Products Endpoint:</span>
              <div className="mt-1 p-2 bg-slate-100 rounded font-mono text-xs">
                {CONFIG_BASE_URL}/api/products
              </div>
            </div>

            <div>
              <span className="font-medium">Headers Sent:</span>
              <div className="mt-1 p-2 bg-slate-100 rounded font-mono text-xs">
                Content-Type: application/json<br />
                {apiKey && `x-api-key: ${apiKey.substring(0, 12)}...`}<br />
                {authToken && `Authorization: Bearer ${authToken.substring(0, 30)}...`}<br />
                Credentials: include
              </div>
            </div>
          </div>
        </Card>

        {/* localStorage Dump */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">localStorage Contents</h2>
          
          <div className="space-y-2 text-sm">
            {Object.keys(localStorage).map(key => (
              <details key={key}>
                <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900 py-1">
                  {key}
                </summary>
                <div className="mt-1 ml-4 p-2 bg-slate-100 rounded font-mono text-xs overflow-x-auto max-h-32">
                  {localStorage.getItem(key)}
                </div>
              </details>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                localStorage.removeItem('productsConfig');
                alert('Products cache cleared');
              }}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Clear Products Cache
            </button>
            
            <button
              onClick={() => {
                localStorage.clear();
                alert('All localStorage cleared. Redirecting to login...');
                navigate('/login');
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Clear All Data
            </button>
            
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Reload App
            </button>

            <button
              onClick={async () => {
                await clearMediaCache();
                setMediaCacheEntries(0);
                alert('Media cache cleared');
              }}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
            >
              Clear Media Cache
            </button>

            <button
              onClick={async () => {
                await clearPresentationCache();
                setPresentationCacheEntries(0);
                alert('Presentation cache cleared');
              }}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
            >
              Clear Presentation Cache
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
