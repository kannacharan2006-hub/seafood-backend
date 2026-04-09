const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only owners can view this report.'
    });
  }
  next();
};

/* ==================== 8x VALUABLE BUSINESS REPORTS ==================== */

/* 1️⃣ DAILY SALES DASHBOARD */
router.get('/daily-sales', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ message: "from and to dates required" });

  try {
    const [dailyData] = await db.promise().query(`
      SELECT 
        DATE(e.date) as sale_date,
        COUNT(DISTINCT e.id) as invoices,
        COUNT(ei.id) as total_items,
        SUM(ei.total) as daily_revenue,
        SUM(ei.quantity) as daily_kg
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ?
      AND e.date BETWEEN ? AND ?
      GROUP BY DATE(e.date) ORDER BY sale_date DESC
    `, [companyId, from, to]);

    const totalRevenue = dailyData.reduce((sum, day) => sum + parseFloat(day.daily_revenue || 0), 0);
    
    res.json({
      summary: {
        total_revenue: totalRevenue.toFixed(2),
        total_invoices: dailyData.reduce((sum, day) => sum + parseInt(day.invoices), 0),
        avg_daily_revenue: (totalRevenue / dailyData.length).toFixed(2),
        total_kg_sold: dailyData.reduce((sum, day) => sum + parseFloat(day.daily_kg), 0)
      },
      daily_data: dailyData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 2️⃣ TOP CUSTOMERS - Revenue Whales */
router.get('/top-customers', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { limit = 10 } = req.query;

  try {
    const [customers] = await db.promise().query(`
      SELECT 
        c.name, c.phone,
        COUNT(e.id) as invoices,
        SUM(ei.total) as revenue,
        AVG(ei.total) as avg_invoice,
        MAX(e.date) as last_order
      FROM exports e 
      JOIN export_items ei ON e.id = ei.export_id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.company_id = ?
      GROUP BY c.id HAVING revenue > 0 
      ORDER BY revenue DESC LIMIT ?
    `, [companyId, parseInt(limit)]);

    res.json({ top_customers: customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 3️⃣ TOP PRODUCTS - Best Sellers with Profit */
router.get('/top-products', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { limit = 10 } = req.query;

  try {
    const [products] = await db.promise().query(`
      SELECT 
        i.name, v.variant_name,
        SUM(ei.quantity) as kg_sold,
        SUM(ei.total) as revenue,
        AVG(ei.price_per_kg) as avg_selling_price,
        COUNT(DISTINCT e.id) as invoices
      FROM exports e 
      JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ?
      GROUP BY i.id, v.id 
      HAVING kg_sold > 0
      ORDER BY kg_sold DESC 
      LIMIT ?
    `, [companyId, parseInt(limit)]);

    // Calculate estimated profit (assume 15% cost margin if no cost data)
    const productsWithProfit = products.map(p => {
      const revenue = parseFloat(p.revenue || 0);
      const kgSold = parseFloat(p.kg_sold || 0);
      const avgSelling = parseFloat(p.avg_selling_price || 0);
      
      // Estimate cost as 70% of selling price (typical for seafood business)
      const estimatedCost = avgSelling * 0.70;
      const profit = revenue - (estimatedCost * kgSold);
      const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
      
      return {
        ...p,
        profit: profit.toFixed(2),
        margin: margin,
        avg_selling_price: avgSelling.toFixed(2)
      };
    });

    res.json({ best_sellers: productsWithProfit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 4️⃣ REVENUE PERFORMANCE - Price Analysis */
router.get('/revenue-performance', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { from, to } = req.query;

  try {
    const [report] = await db.promise().query(`
      SELECT 
        i.name AS product_name,
        v.variant_name,
        SUM(ei.quantity) as total_kg_sold,
        SUM(ei.total) as total_revenue,
        AVG(ei.price_per_kg) as avg_selling_price,
        MIN(ei.price_per_kg) as lowest_price,
        MAX(ei.price_per_kg) as highest_price
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ?
      ${from && to ? 'AND e.date BETWEEN ? AND ?' : ''}
      GROUP BY i.id, v.id HAVING total_kg_sold > 0
      ORDER BY total_revenue DESC
    `, [companyId, from, to].filter(Boolean));

    res.json({ performance: report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 5️⃣ MONTHLY TRENDS - Growth Analytics */
router.get('/monthly-trends', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const months = parseInt(req.query.months) || 6;

  try {
    const [trends] = await db.promise().query(`
      SELECT 
        DATE_FORMAT(e.date, '%Y-%m') as month,
        COUNT(DISTINCT e.id) as invoices,
        SUM(ei.total) as revenue,
        SUM(ei.quantity) as total_kg
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ?
      AND e.date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY month ORDER BY month DESC
    `, [companyId, months]);

    res.json({ trends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 6️⃣ INVOICE STATUS - Payment Tracking */
router.get('/invoice-status', verifyToken, requireOwner, async (req, res) => {

  const companyId = req.user.company_id;

  try {

    const [status] = await db.promise().query(`
      SELECT 
        COUNT(DISTINCT e.id) as total_invoices,
        SUM(ei.total) as total_outstanding
      FROM exports e
      JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ?
    `, [companyId]);

    res.json({
      collection_status: {
        total_invoices: status[0].total_invoices,
        total_outstanding: status[0].total_outstanding
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

/* 7️⃣ CUSTOMER LIFETIME VALUE */
router.get('/customer-ltv', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;

  try {
    const [ltv] = await db.promise().query(`
      SELECT 
        c.name,
        COUNT(e.id) as total_orders,
        SUM(ei.total) as lifetime_value,
        AVG(ei.total) as avg_order_value,
        MIN(e.date) as first_order,
        MAX(e.date) as last_order,
        DATEDIFF(MAX(e.date), MIN(e.date)) as customer_age_days
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.company_id = ?
      GROUP BY c.id HAVING total_orders > 1
      ORDER BY lifetime_value DESC LIMIT 20
    `, [companyId]);

    res.json({ high_value_customers: ltv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 9️⃣ PURCHASE VS SALES PROFIT ANALYSIS */
router.get('/purchase-vs-sales', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;

  try {
    // Get total sales (exports)
    const [salesData] = await db.promise().query(`
      SELECT 
        COALESCE(SUM(ei.total), 0) as total_sales,
        COALESCE(SUM(ei.quantity), 0) as total_kg_sold
      FROM exports e 
      JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ?
    `, [companyId]);

    // Get total purchases
    const [purchaseData] = await db.promise().query(`
      SELECT 
        COALESCE(SUM(pi.total), 0) as total_purchases,
        COALESCE(SUM(pi.quantity), 0) as total_kg_purchased
      FROM purchases p 
      JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.company_id = ?
    `, [companyId]);

    const totalSales = parseFloat(salesData[0]?.total_sales || 0);
    const totalPurchases = parseFloat(purchaseData[0]?.total_purchases || 0);
    const grossProfit = totalSales - totalPurchases;
    const profitMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0;

    res.json({
      profit_analysis: {
        total_sales: totalSales.toFixed(2),
        total_purchases: totalPurchases.toFixed(2),
        gross_profit: grossProfit.toFixed(2),
        profit_margin: profitMargin,
        kg_sold: parseFloat(salesData[0]?.total_kg_sold || 0),
        kg_purchased: parseFloat(purchaseData[0]?.total_kg_purchased || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 🔟 TOP VENDORS BY PURCHASE VOLUME */
router.get('/top-vendors', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { limit = 10 } = req.query;

  try {
    const [vendors] = await db.promise().query(`
      SELECT 
        v.name, v.phone,
        COUNT(DISTINCT p.id) as total_orders,
        COALESCE(SUM(pi.total), 0) as total_purchase_value,
        COALESCE(SUM(pi.quantity), 0) as total_kg_purchased,
        AVG(pi.total) as avg_order_value,
        MAX(p.date) as last_order_date
      FROM purchases p 
      JOIN purchase_items pi ON p.id = pi.purchase_id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.company_id = ?
      GROUP BY v.id 
      HAVING total_purchase_value > 0
      ORDER BY total_purchase_value DESC 
      LIMIT ?
    `, [companyId, parseInt(limit)]);

    res.json({ top_vendors: vendors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* 8️⃣ PRICE TREND ANALYSIS */
router.get('/price-trends', verifyToken, requireOwner, async (req, res) => {
  const companyId = req.user.company_id;
  const { product_name } = req.query;

  try {
    const [trends] = await db.promise().query(`
      SELECT 
        i.name as product,
        DATE_FORMAT(e.date, '%Y-%m') as month,
        ROUND(AVG(ei.price_per_kg), 2) as avg_price,
        ROUND(MIN(ei.price_per_kg), 2) as min_price,
        ROUND(MAX(ei.price_per_kg), 2) as max_price,
        COUNT(*) as transactions
      FROM exports e 
      JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ?
      ${product_name ? 'AND i.name LIKE ?' : ''}
      AND e.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY i.id, DATE_FORMAT(e.date, '%Y-%m')
      ORDER BY i.name, month
    `, [companyId, product_name ? `%${product_name}%` : null].filter(Boolean));

    res.json({ price_trends: trends });
  } catch (error) {
    console.error('Price Trends Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
