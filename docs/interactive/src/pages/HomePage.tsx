import React from 'react';
import { Link } from 'react-router-dom';
import { Book, Monitor, Shield, Rocket, TestTube, ArrowRight } from 'lucide-react';
import { useDocumentation } from '../contexts/DocumentationContext';

const HomePage: React.FC = () => {
  const { apiDocumentation, loading, error } = useDocumentation();

  const quickLinks = [
    {
      title: 'API Documentation',
      description: 'Complete API reference with examples and interactive testing',
      icon: <Book className="w-8 h-8 text-blue-600" />,
      path: '/api',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      title: 'Monitoring',
      description: 'Sentry, Redis, database monitoring and health checks',
      icon: <Monitor className="w-8 h-8 text-green-600" />,
      path: '/monitoring',
      color: 'bg-green-50 border-green-200'
    },
    {
      title: 'Security',
      description: 'Security hardening, firewall configuration, and access control',
      icon: <Shield className="w-8 h-8 text-red-600" />,
      path: '/security',
      color: 'bg-red-50 border-red-200'
    },
    {
      title: 'Deployment',
      description: 'Production deployment guides and configuration',
      icon: <Rocket className="w-8 h-8 text-purple-600" />,
      path: '/deployment',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      title: 'API Testing',
      description: 'Interactive API testing interface with live examples',
      icon: <TestTube className="w-8 h-8 text-orange-600" />,
      path: '/testing',
      color: 'bg-orange-50 border-orange-200'
    }
  ];

  const stats = [
    {
      label: 'API Endpoints',
      value: apiDocumentation?.routes.length || 0,
      description: 'Documented endpoints'
    },
    {
      label: 'Categories',
      value: new Set(apiDocumentation?.routes.flatMap(r => r.tags || [])).size || 0,
      description: 'API categories'
    },
    {
      label: 'Examples',
      value: apiDocumentation?.routes.reduce((acc, route) => acc + (route.examples?.length || 0), 0) || 0,
      description: 'Code examples'
    }
  ];

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
        <h3 className="text-red-800 font-medium">Error loading documentation</h3>
        <p className="text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          KPI Productivity API Documentation
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
          Comprehensive documentation for the KPI Productivity application including API reference, 
          monitoring guides, security configuration, and interactive testing tools.
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/api"
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            Get Started
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
          <Link
            to="/testing"
            className="border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 px-6 py-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Try API Testing
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">{stat.label}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{stat.description}</div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Documentation Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickLinks.map((link, index) => (
            <Link
              key={index}
              to={link.path}
              className={`block p-6 rounded-lg border-2 ${link.color} hover:shadow-md transition-all duration-200 group`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {link.icon}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-gray-600 mt-2 text-sm">
                    {link.description}
                  </p>
                  <div className="flex items-center mt-3 text-blue-600 text-sm font-medium">
                    Learn more
                    <ArrowRight className="ml-1 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Updates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Updates</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Interactive API Testing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Added live API testing interface with request/response examples
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Today</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Security Documentation</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comprehensive security hardening and firewall configuration guides
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">2 days ago</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Monitoring Integration</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Added Sentry, Redis, and database monitoring documentation
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">1 week ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;