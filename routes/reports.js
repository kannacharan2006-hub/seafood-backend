const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied. Only owners can view this report.');
  }
  next();
};

router.get('/daily-sales', verifyToken, requireOwner, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return ApiResponse.error(res, 'from and to dates required', 400);

  try {
    const dailyData = await Database.getAll(`
      SELECT 
        DATE(e.date) as sale_date,
        COUNT(DISTINCT e.id) as invoices,
        COUNT(ei.id) as total_items,
        SUM(ei.total) as daily_revenue,
        SUM(ei.quantity) as daily_kg
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ? AND e.date BETWEEN ? AND ?
      GROUP BY DATE(e.date) ORDER BY sale_date DESC
    `, [req.user.company_id, from, to]);

    const totalRevenue = dailyData.reduce((sum, day) => sum + parseFloat(day.daily_revenue || 0), 0);
    
    res.json({
      success: true,
      summary: {
        total_revenue: totalRevenue.toFixed(2),
        total_invoices: dailyData.reduce((sum, day) => sum + parseInt(day.invoices), 0),
        avg_daily_revenue: (totalRevenue / dailyData.length).toFixed(2),
        total_kg_sold: dailyData.reduce((sum, day) => sum + parseFloat(day.daily_kg), 0)
      },
      daily_data: dailyData
    });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/top-customers', verifyToken, requireOwner, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const top_customers = await Database.getAll(`
      SELECT c.name, c.phone, COUNT(e.id) as invoices, SUM(ei.total) as revenue,
             AVG(ei.total) as avg_invoice, MAX(e.date) as last_order
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.company_id = ? GROUP BY c.id HAVING revenue > 0 
      ORDER BY revenue DESC LIMIT ?
    `, [req.user.company_id, parseInt(limit)]);
    res.json({ success: true, top_customers });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/top-products', verifyToken, requireOwner, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const products = await Database.getAll(`
      SELECT i.name, v.variant_name, SUM(ei.quantity) as kg_sold, SUM(ei.total) as revenue,
             AVG(ei.price_per_kg) as avg_selling_price, COUNT(DISTINCT e.id) as invoices
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ? GROUP BY i.id, v.id HAVING kg_sold > 0
      ORDER BY kg_sold DESC LIMIT ?
    `, [req.user.company_id, parseInt(limit)]);

    const best_sellers = products.map(p => {
      const revenue = parseFloat(p.revenue || 0);
      const kgSold = parseFloat(p.kg_sold || 0);
      const avgSelling = parseFloat(p.avg_selling_price || 0);
      const profit = revenue - (avgSelling * 0.70 * kgSold);
      return {
        ...p,
        profit: profit.toFixed(2),
        margin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0,
        avg_selling_price: avgSelling.toFixed(2)
      };
    });

    res.json({ success: true, best_sellers });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/revenue-performance', verifyToken, requireOwner, async (req, res) => {
  const { from, to } = req.query;
  const params = from && to ? [req.user.company_id, from, to] : [req.user.company_id];
  const filter = from && to ? 'AND e.date BETWEEN ? AND ?' : '';
  
  try {
    const performance = await Database.getAll(`
      SELECT i.name AS product_name, v.variant_name,
             SUM(ei.quantity) as total_kg_sold, SUM(ei.total) as total_revenue,
             AVG(ei.price_per_kg) as avg_selling_price,
             MIN(ei.price_per_kg) as lowest_price, MAX(ei.price_per_kg) as highest_price
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ? ${filter}
      GROUP BY i.id, v.id HAVING total_kg_sold > 0 ORDER BY total_revenue DESC
    `, params);
    res.json({ success: true, performance });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/monthly-trends', verifyToken, requireOwner, async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  try {
    const trends = await Database.getAll(`
      SELECT DATE_FORMAT(e.date, '%Y-%m') as month,
             COUNT(DISTINCT e.id) as invoices, SUM(ei.total) as revenue, SUM(ei.quantity) as total_kg
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ? AND e.date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY month ORDER BY month DESC
    `, [req.user.company_id, months]);
    res.json({ success: true, trends });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/invoice-status', verifyToken, requireOwner, async (req, res) => {
  try {
    const status = await Database.getOne(`
      SELECT COUNT(DISTINCT e.id) as total_invoices, SUM(ei.total) as total_outstanding
      FROM exports e JOIN export_items ei ON e.id = ei.export_id WHERE e.company_id = ?
    `, [req.user.company_id]);
    res.json({ success: true, collection_status: { total_invoices: status.total_invoices, total_outstanding: status.total_outstanding } });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/customer-ltv', verifyToken, requireOwner, async (req, res) => {
  try {
    const high_value_customers = await Database.getAll(`
      SELECT c.name, COUNT(e.id) as total_orders, SUM(ei.total) as lifetime_value,
             AVG(ei.total) as avg_order_value, MIN(e.date) as first_order,
             MAX(e.date) as last_order, DATEDIFF(MAX(e.date), MIN(e.date)) as customer_age_days
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.company_id = ? GROUP BY c.id HAVING total_orders > 1
      ORDER BY lifetime_value DESC LIMIT 20
    `, [req.user.company_id]);
    res.json({ success: true, high_value_customers });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/purchase-vs-sales', verifyToken, requireOwner, async (req, res) => {
  try {
    const salesData = await Database.getOne(`
      SELECT COALESCE(SUM(ei.total), 0) as total_sales, COALESCE(SUM(ei.quantity), 0) as total_kg_sold
      FROM exports e JOIN export_items ei ON e.id = ei.export_id WHERE e.company_id = ?
    `, [req.user.company_id]);

    const purchaseData = await Database.getOne(`
      SELECT COALESCE(SUM(pi.total), 0) as total_purchases, COALESCE(SUM(pi.quantity), 0) as total_kg_purchased
      FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE p.company_id = ?
    `, [req.user.company_id]);

    const totalSales = parseFloat(salesData?.total_sales || 0);
    const totalPurchases = parseFloat(purchaseData?.total_purchases || 0);
    const grossProfit = totalSales - totalPurchases;
    const profitMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      profit_analysis: {
        total_sales: totalSales.toFixed(2),
        total_purchases: totalPurchases.toFixed(2),
        gross_profit: grossProfit.toFixed(2),
        profit_margin: profitMargin,
        kg_sold: parseFloat(salesData?.total_kg_sold || 0),
        kg_purchased: parseFloat(purchaseData?.total_kg_purchased || 0)
      }
    });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/top-vendors', verifyToken, requireOwner, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const top_vendors = await Database.getAll(`
      SELECT v.name, v.phone, COUNT(DISTINCT p.id) as total_orders,
             COALESCE(SUM(pi.total), 0) as total_purchase_value,
             COALESCE(SUM(pi.quantity), 0) as total_kg_purchased,
             AVG(pi.total) as avg_order_value, MAX(p.date) as last_order_date
      FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id
      LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.company_id = ?
      GROUP BY v.id HAVING total_purchase_value > 0
      ORDER BY total_purchase_value DESC LIMIT ?
    `, [req.user.company_id, parseInt(limit)]);
    res.json({ success: true, top_vendors });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/price-trends', verifyToken, requireOwner, async (req, res) => {
  const { product_name } = req.query;
  const params = product_name ? [req.user.company_id, `%${product_name}%`] : [req.user.company_id];
  const filter = product_name ? 'AND i.name LIKE ?' : '';
  
  try {
    const price_trends = await Database.getAll(`
      SELECT i.name as product, DATE_FORMAT(e.date, '%Y-%m') as month,
             ROUND(AVG(ei.price_per_kg), 2) as avg_price,
             ROUND(MIN(ei.price_per_kg), 2) as min_price,
             ROUND(MAX(ei.price_per_kg), 2) as max_price, COUNT(*) as transactions
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id JOIN items i ON v.item_id = i.id
      WHERE e.company_id = ? ${filter} AND e.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY i.id, DATE_FORMAT(e.date, '%Y-%m') ORDER BY i.name, month
    `, params);
    res.json({ success: true, price_trends });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

/* 1️⃣2️⃣ YESTERDAY'S PROFIT/LOSS */
router.get('/yesterday-profit', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;

  try {
    // Get yesterday's sales
    const [sales] = await db.promise().query(`
      SELECT 
        COALESCE(SUM(ei.total), 0) as total_sales,
        COALESCE(SUM(ei.quantity), 0) as kg_sold,
        COUNT(DISTINCT e.id) as invoices
      FROM exports e 
      JOIN export_items ei ON e.id = ei.export_id
      WHERE e.company_id = ? AND e.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `, [companyId]);

    // Get yesterday's purchases
    const [purchases] = await db.promise().query(`
      SELECT 
        COALESCE(SUM(pi.total), 0) as total_purchases,
        COALESCE(SUM(pi.quantity), 0) as kg_purchased,
        COUNT(DISTINCT p.id) as orders
      FROM purchases p 
      JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE p.company_id = ? AND p.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `, [companyId]);

    const yesterdaySales = parseFloat(sales[0]?.total_sales || 0);
    const yesterdayPurchases = parseFloat(purchases[0]?.total_purchases || 0);
    const profit = yesterdaySales - yesterdayPurchases;
    const margin = yesterdaySales > 0 ? ((profit / yesterdaySales) * 100).toFixed(1) : 0;

    res.json({
      yesterday: {
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        sales: yesterdaySales.toFixed(2),
        purchases: yesterdayPurchases.toFixed(2),
        profit: profit.toFixed(2),
        margin: margin,
        kg_sold: sales[0]?.kg_sold || 0,
        kg_purchased: purchases[0]?.kg_purchased || 0,
        sales_invoices: sales[0]?.invoices || 0,
        purchase_orders: purchases[0]?.orders || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
