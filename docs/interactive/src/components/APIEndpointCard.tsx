import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock, TestTube, Copy, Check } from 'lucide-react';
import { RouteInfo } from '../types';
import CodeBlock from './CodeBlock';

interface APIEndpointCardProps {
  route: RouteInfo;
}

const APIEndpointCard: React.FC<APIEndpointCardProps> = ({ route }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'POST':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PATCH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const copyToClipboard = async (text: string, exampleId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedExample(exampleId);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const buildTestUrl = () => {
    const params = new URLSearchParams({
      method: route.method,
      path: route.path,
      auth: route.authentication ? 'true' : 'false'
    });
    return `/testing?${params.toString()}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getMethodColor(route.method)}`}>
              {route.method}
            </span>
            <code className="text-lg font-mono text-gray-900 dark:text-white">
              {route.path}
            </code>
            {route.authentication && (
              <Lock className="w-4 h-4 text-yellow-600" />
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Link
              to={buildTestUrl()}
              className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
            >
              <TestTube className="w-4 h-4 mr-1" />
              Test
            </Link>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {route.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {route.description}
          </p>
        )}
        {route.tags && route.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {route.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-700 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Parameters */}
          {route.parameters && route.parameters.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Parameters</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Required
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {route.parameters.map((param, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-white">
                          {param.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {param.type}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {param.location}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            param.required 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {param.required ? 'Required' : 'Optional'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {param.description}
                          {param.example && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">Example: </span>
                              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                                {typeof param.example === 'string' ? param.example : JSON.stringify(param.example)}
                              </code>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Responses */}
          {route.responses && route.responses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Responses</h3>
              <div className="space-y-4">
                {route.responses.map((response, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          response.status >= 200 && response.status < 300
                            ? 'bg-green-100 text-green-800'
                            : response.status >= 400
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {response.status}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {response.description}
                        </span>
                      </div>
                    </div>
                    {response.example && (
                      <div className="p-4">
                        <CodeBlock
                          language="json"
                          code={JSON.stringify(response.example, null, 2)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {route.examples && route.examples.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Examples</h3>
              <div className="space-y-4">
                {route.examples.map((example, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {example.description}
                      </span>
                      <button
                        onClick={() => copyToClipboard(example.code, `${index}-${example.language}`)}
                        className="flex items-center px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        {copiedExample === `${index}-${example.language}` ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-4">
                      <CodeBlock
                        language={example.language}
                        code={example.code}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default APIEndpointCard;