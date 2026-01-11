import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Book, 
  Monitor, 
  Shield, 
  Rocket, 
  TestTube, 
  Search,
  Home,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import SearchBar from './SearchBar';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>(['api', 'monitoring']);
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Home',
      icon: <Home size={20} />
    },
    {
      path: '/api',
      label: 'API Documentation',
      icon: <Book size={20} />,
      children: [
        { path: '/api/authentication', label: 'Authentication', icon: null },
        { path: '/api/habits', label: 'Habits & Tracking', icon: null },
        { path: '/api/analytics', label: 'Analytics & KPI', icon: null },
        { path: '/api/teams', label: 'Teams', icon: null },
        { path: '/api/health', label: 'Health Checks', icon: null }
      ]
    },
    {
      path: '/monitoring',
      label: 'Monitoring',
      icon: <Monitor size={20} />,
      children: [
        { path: '/monitoring/sentry', label: 'Sentry Integration', icon: null },
        { path: '/monitoring/redis', label: 'Redis Usage', icon: null },
        { path: '/monitoring/database', label: 'Database Monitoring', icon: null },
        { path: '/monitoring/socketio', label: 'Socket.IO Monitoring', icon: null }
      ]
    },
    {
      path: '/security',
      label: 'Security',
      icon: <Shield size={20} />
    },
    {
      path: '/deployment',
      label: 'Deployment',
      icon: <Rocket size={20} />
    },
    {
      path: '/testing',
      label: 'API Testing',
      icon: <TestTube size={20} />
    }
  ];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              KPI Productivity Docs
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Interactive API Documentation
            </p>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <SearchBar />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <div className="flex items-center">
                    <Link
                      to={item.path}
                      className={`flex items-center flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActiveRoute(item.path)
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {item.icon}
                      <span className="ml-3">{item.label}</span>
                    </Link>
                    {item.children && (
                      <button
                        onClick={() => toggleSection(item.path.substring(1))}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {expandedSections.includes(item.path.substring(1)) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    )}
                  </div>
                  {item.children && expandedSections.includes(item.path.substring(1)) && (
                    <ul className="ml-6 mt-2 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            to={child.path}
                            className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                              isActiveRoute(child.path)
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Version 1.0.0
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <div className="flex items-center space-x-4">
              <Link
                to="/search"
                className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <Search size={20} />
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;