import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDocumentation } from '../contexts/DocumentationContext';
import APIEndpointCard from '../components/APIEndpointCard';
import CodeBlock from '../components/CodeBlock';

const APIDocumentationPage: React.FC = () => {
  const { category } = useParams<{ category?: string }>();
  const { apiDocumentation, loading, error } = useDocumentation();
  const [selectedTag, setSelectedTag] = useState<string>(category || 'all');

  const { filteredRoutes, availableTags } = useMemo(() => {
    if (!apiDocumentation) {
      return { filteredRoutes: [], availableTags: [] };
    }

    const tags = ['all', ...new Set(apiDocumentation.routes.flatMap(route => route.tags || []))];
    const filtered = selectedTag === 'all' 
      ? apiDocumentation.routes 
      : apiDocumentation.routes.filter(route => route.tags?.includes(selectedTag));

    return {
      filteredRoutes: filtered.sort((a, b) => a.path.localeCompare(b.path)),
      availableTags: tags
    };
  }, [apiDocumentation, selectedTag]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-red-800 font-medium">Error loading API documentation</h3>
        <p className="text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!apiDocumentation) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          No API documentation available
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please check your connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {apiDocumentation.title}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
          {apiDocumentation.description}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Version: {apiDocumentation.version}</span>
          <span>Base URL: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{apiDocumentation.baseUrl}</code></span>
          <span>Last updated: {new Date(apiDocumentation.generatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">Quick Start</h2>
        <p className="text-blue-800 dark:text-blue-200 mb-4">
          Get started with the KPI Productivity API by following these steps:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-200">
          <li>Register a new account or login to get your JWT token</li>
          <li>Include the token in the Authorization header for protected endpoints</li>
          <li>Use the interactive testing interface to try out endpoints</li>
        </ol>
        <div className="mt-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Authentication Example:</h3>
          <CodeBlock
            language="javascript"
            code={`// Login to get JWT token
const response = await fetch('${apiDocumentation.baseUrl}/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});

const { token } = await response.json();

// Use token for authenticated requests
const habitsResponse = await fetch('${apiDocumentation.baseUrl}/api/habits', {
  headers: { 'Authorization': \`Bearer \${token}\` }
});`}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tag === 'all' ? 'All Endpoints' : tag.charAt(0).toUpperCase() + tag.slice(1)}
              <span className="ml-2 text-xs opacity-75">
                ({tag === 'all' ? apiDocumentation.routes.length : apiDocumentation.routes.filter(r => r.tags?.includes(tag)).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-6">
        {filteredRoutes.length > 0 ? (
          filteredRoutes.map((route, index) => (
            <APIEndpointCard key={`${route.method}-${route.path}-${index}`} route={route} />
          ))
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No endpoints found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No API endpoints match the selected category.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            This documentation is automatically generated from the API routes.
            For issues or questions, please contact the development team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default APIDocumentationPage;