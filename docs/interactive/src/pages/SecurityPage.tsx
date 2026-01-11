import React from 'react';
import { Shield, Lock, Server, AlertTriangle } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';

const SecurityPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Shield className="w-8 h-8 text-red-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Security Documentation
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Comprehensive security hardening, firewall configuration, and access control documentation.
        </p>
      </div>

      <div className="space-y-8">
        {/* Network Security */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Server className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Network Security Configuration
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Port Restriction (localhost:30002 only)
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The application is configured to only accept connections on localhost:30002, with all other ports blocked.
              </p>

              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Linux (iptables) Configuration:</h4>
              <CodeBlock
                language="bash"
                code={`# Block all incoming connections except localhost:30002
sudo iptables -P INPUT DROP
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 30002 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Save rules (Ubuntu/Debian)
sudo iptables-save > /etc/iptables/rules.v4

# Save rules (CentOS/RHEL)
sudo service iptables save`}
              />

              <h4 className="font-medium text-gray-900 dark:text-white mb-2 mt-4">macOS (pfctl) Configuration:</h4>
              <CodeBlock
                language="bash"
                code={`# Create firewall rules file
echo "block all" > /tmp/pf.rules
echo "pass in on lo0 proto tcp from 127.0.0.1 to 127.0.0.1 port 30002" >> /tmp/pf.rules

# Load and enable rules
sudo pfctl -f /tmp/pf.rules -e

# Make persistent (add to /etc/pf.conf)
sudo cp /tmp/pf.rules /etc/pf.conf`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                API Gateway Configuration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The API gateway serves as the single entry point, proxying requests to internal services.
              </p>

              <CodeBlock
                language="javascript"
                code={`const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Proxy to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  secure: false,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Proxy to frontend
app.use('/', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  secure: false
}));

app.listen(30002, 'localhost', () => {
  console.log('API Gateway running on localhost:30002');
});`}
              />
            </div>
          </div>
        </div>

        {/* Authentication & Authorization */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Lock className="w-6 h-6 text-green-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Authentication & Authorization
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                JWT Token Security
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                All API endpoints use JWT tokens for authentication with proper security measures.
              </p>

              <CodeBlock
                language="javascript"
                code={`const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET; // Strong secret key
const JWT_EXPIRES_IN = '24h';

// Token generation
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role 
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'kpi-productivity',
      audience: 'kpi-productivity-users'
    }
  );
};

// Token verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Password hashing
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Input Validation & Sanitization
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                All user inputs are validated and sanitized to prevent injection attacks.
              </p>

              <CodeBlock
                language="javascript"
                code={`const { body, validationResult } = require('express-validator');
const xss = require('xss');

// Validation rules
const validateHabit = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be 1-100 characters')
    .custom(value => {
      // Sanitize XSS
      const sanitized = xss(value);
      if (sanitized !== value) {
        throw new Error('Invalid characters detected');
      }
      return true;
    }),
  body('targetMinutes')
    .isInt({ min: 1, max: 1440 })
    .withMessage('Target minutes must be between 1 and 1440'),
  body('category')
    .trim()
    .isIn(['Health', 'Work', 'Personal', 'Learning'])
    .withMessage('Invalid category')
];

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Usage
app.post('/api/habits', 
  authenticateToken,
  validateHabit,
  handleValidationErrors,
  createHabit
);`}
              />
            </div>
          </div>
        </div>

        {/* Security Monitoring */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Security Monitoring & Logging
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Access Logging
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                All access attempts are logged for security monitoring and audit purposes.
              </p>

              <CodeBlock
                language="javascript"
                code={`const winston = require('winston');
const path = require('path');

// Security logger configuration
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/security.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Access logging middleware
const logAccess = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId || 'anonymous'
  };

  securityLogger.info('Access attempt', logData);
  next();
};

// Failed authentication logging
const logFailedAuth = (req, email, reason) => {
  securityLogger.warn('Authentication failed', {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    email,
    reason,
    userAgent: req.get('User-Agent')
  });
};

// Suspicious activity detection
const detectSuspiciousActivity = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  
  // Rate limiting per IP
  if (!ipAttempts.has(ip)) {
    ipAttempts.set(ip, []);
  }
  
  const attempts = ipAttempts.get(ip);
  const recentAttempts = attempts.filter(time => now - time < 60000); // 1 minute
  
  if (recentAttempts.length > 10) {
    securityLogger.error('Suspicious activity detected', {
      ip,
      attempts: recentAttempts.length,
      timestamp: new Date().toISOString()
    });
    
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  attempts.push(now);
  ipAttempts.set(ip, attempts);
  next();
};`}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Security Testing
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Automated security testing to verify firewall rules and access restrictions.
              </p>

              <CodeBlock
                language="javascript"
                code={`const axios = require('axios');
const net = require('net');

// Port scanning test
const testPortAccess = async (host, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
};

// Security test suite
const runSecurityTests = async () => {
  console.log('Running security tests...');

  // Test 1: Only localhost:30002 should be accessible
  const allowedAccess = await testPortAccess('localhost', 30002);
  console.log(\`localhost:30002 accessible: \${allowedAccess}\`);

  // Test 2: Direct backend access should be blocked
  const blockedBackend = await testPortAccess('localhost', 3001);
  console.log(\`localhost:3001 blocked: \${!blockedBackend}\`);

  // Test 3: Direct frontend access should be blocked
  const blockedFrontend = await testPortAccess('localhost', 3000);
  console.log(\`localhost:3000 blocked: \${!blockedFrontend}\`);

  // Test 4: Authentication required for protected endpoints
  try {
    const response = await axios.get('http://localhost:30002/api/habits');
    console.log('Unauth access blocked:', response.status === 401);
  } catch (error) {
    console.log('Unauth access blocked:', error.response?.status === 401);
  }

  console.log('Security tests completed');
};

// Run tests periodically
setInterval(runSecurityTests, 3600000); // Every hour`}
              />
            </div>
          </div>
        </div>

        {/* Security Checklist */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">
            Security Checklist
          </h2>
          <div className="space-y-2 text-blue-800 dark:text-blue-200">
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>Firewall configured to block all ports except localhost:30002</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>API Gateway with security headers and rate limiting</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>JWT authentication for all protected endpoints</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>Input validation and XSS protection</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>Comprehensive access logging</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>Automated security testing</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>Password hashing with bcrypt</span>
            </div>
            <div className="flex items-center">
              <input type="checkbox" checked readOnly className="mr-2" />
              <span>HTTPS in production</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityPage;