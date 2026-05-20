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

/* ================= ENVIRONMENT VALIDATION ================= */

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

/* ================= MIDDLEWARE ================= */

app.use(helmet());

// Configure CORS with restrictions
const corsOptions = {
    origin: (origin, callback) => {
        // In development, allow all origins
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
            return;
        }

        // In production, require FRONTEND_URL to be set
        const allowedOrigins = process.env.FRONTEND_URL ?
            process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [];

        // In production, if no FRONTEND_URL is configured, allow all origins (permissive fallback)
        if (allowedOrigins.length === 0) {
            logger.warn('CORS: No FRONTEND_URL configured. Allowing all origins. Set FRONTEND_URL in environment for production security.');
            callback(null, true);
            return;
        }

        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
            callback(null, true);
            return;
        }

        // Normalize origin (remove trailing slash)
        const normalizedOrigin = origin.replace(/\/$/, '');
        const normalizedAllowed = allowedOrigins.map(o => o.replace(/\/$/, ''));

        if (normalizedAllowed.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked origin:', origin);
            callback(new Error('CORS policy: Origin not allowed'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
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
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/webhook', require('./routes/webhookRoutes'));
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

/* ================= 404 HANDLER ================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        statusCode: 404
    });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use(require('./middleware/errorHandler'));

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

wsManager.initialize(server);

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    logger.info(`Health check available at http://0.0.0.0:${PORT}/health`);
    SchedulerService.start();

    // Start scheduled backups
    const BackupService = require('./services/backupService');
    BackupService.startScheduledBackups();
});

/* ================= GRACEFUL SHUTDOWN ================= */

function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
        logger.info('HTTP server closed.');

        // Close WebSocket connections
        wsManager.close();
        logger.info('WebSocket server closed.');

        // Close database pool
        const db = require('./config/db');
        db.end((err) => {
            if (err) {
                logger.error('Error closing database pool:', err);
            } else {
                logger.info('Database pool closed.');
            }
            logger.info('Graceful shutdown complete.');
            process.exit(0);
        });
    });

    // Force shutdown after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));