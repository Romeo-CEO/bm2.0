import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import filesRoutes from './routes/files';
import azureAdB2cRoutes from './routes/azure-ad-b2c';
import applicationsRoutes from './routes/applications';
import templatesRoutes from './routes/templates';
import subscriptionsRoutes from './routes/subscriptions';
import companiesRoutes from './routes/companies';
import adminRoutes from './routes/admin';
import ssoRoutes from './routes/sso';
import analyticsRoutes from './routes/analytics';
import companyRoutes from './routes/company';
import paymentsRoutes from './routes/payments';
import settingsRoutes from './routes/settings';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/azure-ad-b2c', azureAdB2cRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/settings', settingsRoutes);
// 404 handler - using a proper catch-all pattern
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection (non-blocking for now)
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but server will start anyway');
      console.warn('⚠️  API endpoints requiring database will return errors');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      if (dbConnected) {
        console.log(`✅ Database connected successfully`);
      } else {
        console.log(`❌ Database not connected - some features will be unavailable`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
