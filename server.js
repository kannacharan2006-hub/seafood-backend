require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { limiter } = require('./config/rateLimit');

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());

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

/* ================= HEALTH CHECK ================= */

app.get('/', (req, res) => {
    res.send('Seafood ERP Backend Running');
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'Test route working' });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});