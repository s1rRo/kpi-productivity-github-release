import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';

// Import Sentry
import { initializeSentry, setupSentryErrorHandler } from './middleware/sentry';

// Import migrations
import { runMigrations } from './utils/migrations';

// Import real-time services
import { connectRedis, disconnectRedis } from './services/redisClient';
import SocketService from './services/socketService';

// Import routes
import authRoutes from './routes/auth';
import habitsRoutes from './routes/habits';
import dailyRecordsRoutes from './routes/dailyRecords';
import tasksRoutes from './routes/tasks';
import kpiRoutes from './routes/kpi';
import eisenhowerRoutes from './routes/eisenhower';
import skillsRoutes from './routes/skills';
import exceptionsRoutes from './routes/exceptions';
import dashboardRoutes from './routes/dashboard';
import analyticsRoutes from './routes/analytics';
import goalsRoutes from './routes/goals';
import friendsRoutes from './routes/friends';
import teamsRoutes from './routes/teams';
import realtimeRoutes from './routes/realtime';
import principlesRoutes from './routes/principles';
import invitationsRoutes from './routes/invitations';
import healthRoutes from './routes/health';
import documentationRoutes from './routes/documentation';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// Initialize Sentry (must be first)
initializeSentry(app);

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Initialize Socket.IO service
let socketService: SocketService;

// Run migrations and initialize services on startup
async function initializeApp() {
  try {
    console.log('🔄 Running database migrations...');
    await runMigrations();
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // In production, we might want to exit if migrations fail
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 Exiting due to migration failure in production');
      process.exit(1);
    }
  }

  try {
    console.log('🔄 Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    // In production with REDIS_REQUIRED=true, exit
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_REQUIRED === 'true') {
      console.error('💥 Exiting due to Redis failure in production (REDIS_REQUIRED=true)');
      process.exit(1);
    }
  }

  // Initialize Socket.IO service
  socketService = new SocketService(server);
  console.log('✅ Socket.IO service initialized');
}

// Initialize the app
initializeApp();

// Import compression middleware
import { compressionMiddleware, jsonOptimizationMiddleware } from './middleware/compression';

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://kpi-productivity.vercel.app'])
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Add compression middleware before JSON parsing
app.use(compressionMiddleware({
  threshold: 1024, // Compress responses larger than 1KB
  level: 6, // Compression level (1-9)
}));

// Add JSON optimization middleware
app.use(jsonOptimizationMiddleware());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check routes (before other routes for faster response)
app.use('/', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/daily-records', dailyRecordsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/eisenhower', eisenhowerRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/exceptions', exceptionsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/principles', principlesRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/docs', documentationRoutes);

// Legacy health check endpoint (for backward compatibility)
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'ERROR', 
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Setup Sentry error handler (must be before other error handlers)
setupSentryErrorHandler(app);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err.stack);
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Something went wrong!';
    
  res.status(err.status || 500).json({ 
    error: errorMessage,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 KPI Productivity 2026 API ready`);
    console.log(`🔌 Socket.IO ready for real-time connections`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
  });
}

// Export app and socketService for testing
export default app;
export { socketService };

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Close server
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Disconnect from database
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    
    // Disconnect from Redis
    await disconnectRedis();
    console.log('✅ Redis disconnected');
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});