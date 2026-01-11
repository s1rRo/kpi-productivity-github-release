import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Save, Trash2, Download, Upload } from 'lucide-react';
import { APITestRequest, APITestResponse } from '../types';
import { apiTestingService } from '../services/apiTestingService';
import CodeBlock from '../components/CodeBlock';

const APITestingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [request, setRequest] = useState<APITestRequest>({
    method: searchParams.get('method') || 'GET',
    url: searchParams.get('path') || '/api/health',
    headers: {
      'Content-Type': 'application/json',
      ...(searchParams.get('auth') === 'true' ? { 'Authorization': 'Bearer YOUR_JWT_TOKEN' } : {})
    },
    body: ''
  });
  const [response, setResponse] = useState<APITestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedRequests, setSavedRequests] = useState<Array<{ name: string; request: APITestRequest }>>([]);
  const [requestName, setRequestName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    // Load saved requests from localStorage
    const saved = localStorage.getItem('api-testing-requests');
    if (saved) {
      try {
        setSavedRequests(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved requests:', error);
      }
    }
  }, []);

  const executeRequest = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      const result = await apiTestingService.executeRequest(request);
      setResponse(result);
    } catch (error) {
      console.error('Request failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRequest = () => {
    if (!requestName.trim()) return;
    
    const newSavedRequest = { name: requestName.trim(), request: { ...request } };
    const updated = [...savedRequests, newSavedRequest];
    setSavedRequests(updated);
    localStorage.setItem('api-testing-requests', JSON.stringify(updated));
    setRequestName('');
    setShowSaveDialog(false);
  };

  const loadRequest = (savedRequest: { name: string; request: APITestRequest }) => {
    setRequest({ ...savedRequest.request });
    setResponse(null);
  };

  const deleteRequest = (index: number) => {
    const updated = savedRequests.filter((_, i) => i !== index);
    setSavedRequests(updated);
    localStorage.setItem('api-testing-requests', JSON.stringify(updated));
  };

  const updateHeader = (key: string, value: string) => {
    if (value === '') {
      const { [key]: removed, ...rest } = request.headers;
      setRequest({ ...request, headers: rest });
    } else {
      setRequest({
        ...request,
        headers: { ...request.headers, [key]: value }
      });
    }
  };

  const addHeader = () => {
    const key = prompt('Header name:');
    if (key && key.trim()) {
      setRequest({
        ...request,
        headers: { ...request.headers, [key.trim()]: '' }
      });
    }
  };

  const exportRequests = () => {
    const dataStr = JSON.stringify(savedRequests, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'api-requests.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importRequests = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          setSavedRequests(imported);
          localStorage.setItem('api-testing-requests', JSON.stringify(imported));
        }
      } catch (error) {
        alert('Failed to import requests. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          API Testing Interface
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Test API endpoints interactively with live requests and responses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Method and URL */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Request</h2>
            
            <div className="flex space-x-2 mb-4">
              <select
                value={request.method}
                onChange={(e) => setRequest({ ...request, method: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={request.url}
                onChange={(e) => setRequest({ ...request, url: e.target.value })}
                placeholder="/api/endpoint"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={executeRequest}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Send
              </button>
            </div>

            {/* Headers */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Headers</h3>
                <button
                  onClick={addHeader}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Add Header
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(request.headers).map(([key, value]) => (
                  <div key={key} className="flex space-x-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newHeaders = { ...request.headers };
                        delete newHeaders[key];
                        newHeaders[e.target.value] = value;
                        setRequest({ ...request, headers: newHeaders });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Header name"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateHeader(key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Header value"
                    />
                    <button
                      onClick={() => updateHeader(key, '')}
                      className="px-2 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            {['POST', 'PUT', 'PATCH'].includes(request.method) && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Request Body</h3>
                <textarea
                  value={request.body}
                  onChange={(e) => setRequest({ ...request, body: e.target.value })}
                  placeholder='{"key": "value"}'
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
                {request.body && (
                  <div className="mt-2">
                    {apiTestingService.validateJSON(request.body).valid ? (
                      <span className="text-sm text-green-600 dark:text-green-400">✓ Valid JSON</span>
                    ) : (
                      <span className="text-sm text-red-600 dark:text-red-400">
                        ✗ Invalid JSON: {apiTestingService.validateJSON(request.body).error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Response */}
          {response && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Response</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>Status: <span className={`font-medium ${
                    response.status >= 200 && response.status < 300 ? 'text-green-600' :
                    response.status >= 400 ? 'text-red-600' : 'text-yellow-600'
                  }`}>{response.status} {response.statusText}</span></span>
                  <span>Time: {response.duration}ms</span>
                </div>
              </div>

              {/* Response Headers */}
              {Object.keys(response.headers).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Headers</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 text-sm">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex">
                        <span className="font-medium text-gray-700 dark:text-gray-300 w-1/3">{key}:</span>
                        <span className="text-gray-600 dark:text-gray-400 flex-1">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Body */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Body</h3>
                <CodeBlock
                  language="json"
                  code={typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
                />
              </div>
            </div>
          )}

          {/* Code Generation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Code Examples</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">cURL</h3>
                <CodeBlock
                  language="bash"
                  code={apiTestingService.generateCurlCommand(request)}
                />
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">JavaScript</h3>
                <CodeBlock
                  language="javascript"
                  code={apiTestingService.generateJavaScriptCode(request)}
                />
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Python</h3>
                <CodeBlock
                  language="python"
                  code={apiTestingService.generatePythonCode(request)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Saved Requests Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Saved Requests</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  title="Save current request"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={exportRequests}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  title="Export requests"
                >
                  <Download className="w-4 h-4" />
                </button>
                <label className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded cursor-pointer" title="Import requests">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept=".json"
                    onChange={importRequests}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {savedRequests.map((saved, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <button
                    onClick={() => loadRequest(saved)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {saved.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {saved.request.method} {saved.request.url}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteRequest(index)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {savedRequests.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                  No saved requests yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save Request</h3>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Request name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveRequest}
                disabled={!requestName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APITestingPage;