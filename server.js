require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { limiter, authLimiter, loginLimiter } = require('./config/rateLimit');
const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');
const { wsManager } = require('./config/websocket');
const SchedulerService = require('./config/scheduler');
const { requestIdMiddleware, requestLogger } = require('./middleware/requestLogger');

const app = express();
app.set('trust proxy', 1);

/* ================= MIDDLEWARE ================= */

app.use(helmet());
// Configure CORS with restrictions
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Limit request body to 10KB
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // Limit URL-encoded body
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

/* ================= API DOCUMENTATION ================= */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ================= RATE LIMITING ================= */
app.use(limiter);

/* ================= ROUTES ================= */
app.use(require('./middleware/errorHandler'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/stocks', require('./routes/stockRoutes'));
app.use('/api/conversions', require('./routes/conversionRoutes'));
app.use('/api/exports', require('./routes/exportRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/variants', require('./routes/variants'));
app.use('/api/purchase-history', require('./routes/purchaseHistory'));
app.use('/health', require('./routes/healthRoutes'));

/* ================= HEALTH CHECK ================= */

app.get('/', (req, res) => {
    logger.info('Health check endpoint accessed');
    res.send('Seafood ERP Backend Running');
});

app.get('/api/test', (req, res) => {
    logger.info('Test endpoint accessed');
    res.json({ message: 'Test route working' });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {
    logger.error('Request failed', {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl
    });
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        requestId: req.requestId
    });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

wsManager.initialize(server);

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    logger.info(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    logger.info(`Health check available at http://0.0.0.0:${PORT}/health`);
    SchedulerService.start();
    
    // Start scheduled backups
    const BackupService = require('./services/backupService');
    BackupService.startScheduledBackups();
});