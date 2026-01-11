import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, FileText, Code, Monitor, Shield, Rocket } from 'lucide-react';
import { documentationService } from '../services/documentationService';
import { SearchResult } from '../types';

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await documentationService.searchDocumentation(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: query });
    performSearch(query);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api':
        return <Code className="w-5 h-5 text-blue-600" />;
      case 'monitoring':
        return <Monitor className="w-5 h-5 text-green-600" />;
      case 'security':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'deployment':
        return <Rocket className="w-5 h-5 text-purple-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'api':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'monitoring':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'security':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'deployment':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const popularSearches = [
    'authentication',
    'JWT token',
    'habits API',
    'Sentry integration',
    'Redis monitoring',
    'firewall configuration',
    'deployment guide',
    'API testing'
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Search Documentation
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Find information across all documentation sections including API reference, monitoring guides, and deployment instructions.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Searching...</span>
        </div>
      )}

      {/* Search Results */}
      {!loading && hasSearched && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Search Results
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </span>
          </div>

          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  key={result.id}
                  to={result.url}
                  className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      {getCategoryIcon(result.category)}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                        {highlightText(result.title, query)}
                      </h3>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(result.category)}`}>
                      {result.category}
                    </span>
                  </div>
                  {result.excerpt && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                      {highlightText(result.excerpt, query)}
                    </p>
                  )}
                  <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                    {result.url}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No results found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We couldn't find any documentation matching "{query}". Try different keywords or browse the categories below.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {popularSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => {
                      setQuery(search);
                      setSearchParams({ q: search });
                      performSearch(search);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popular Searches */}
      {!hasSearched && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Popular Searches
          </h2>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((search) => (
              <button
                key={search}
                onClick={() => {
                  setQuery(search);
                  setSearchParams({ q: search });
                  performSearch(search);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse Categories */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Browse by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/api"
            className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <Code className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">API Documentation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Complete API reference with examples</p>
            </div>
          </Link>
          
          <Link
            to="/monitoring"
            className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <Monitor className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Monitoring</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sentry, Redis, and database monitoring</p>
            </div>
          </Link>
          
          <Link
            to="/security"
            className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <Shield className="w-8 h-8 text-red-600 mr-4" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Security</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Security hardening and configuration</p>
            </div>
          </Link>
          
          <Link
            to="/deployment"
            className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <Rocket className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Deployment</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Production deployment guides</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;