const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const db = require('../config/db');

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only owners can access this data.'
    });
  }
  next();
};

router.get('/summary', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;
  const userRole = req.user.role;
  const isEmployee = userRole === 'EMPLOYEE';
  const { from, to } = req.query;

  // Validate date params
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !dateRegex.test(from)) || (to && !dateRegex.test(to))) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    // Build date filter for payments
    let paymentDateFilter = '';
    let paymentParams = [companyId];
    if (from && to) {
      paymentDateFilter = ' AND date BETWEEN ? AND ? ';
      paymentParams = [companyId, from, to];
    }

    // Build date filter for totals
    let totalDateFilter = '';
    let totalParams = [companyId];
    if (from && to) {
      totalDateFilter = ' AND date BETWEEN ? AND ? ';
      totalParams = [companyId, from, to];
    }

    // Execute all independent queries in parallel using Promise.all
    const [
      [rawStock],
      [finalStock],
      [todayPurchase],
      [todaySales],
      [monthPurchase],
      [monthSales],
      [totalPurchase],
      [totalSales],
      [vendorPayments],
      [customerPayments],
      [recentActivity],
      [topBuyers],
      [topSuppliers]
    ] = await Promise.all([
      // Stock queries
      db.promise().query(`
        SELECT IFNULL(SUM(rs.available_qty),0) AS total
        FROM raw_stock rs
        WHERE rs.company_id = ?
      `, [companyId]),

      db.promise().query(`
        SELECT IFNULL(SUM(fs.available_qty),0) AS total
        FROM final_stock fs
        WHERE fs.company_id = ?
      `, [companyId]),

      // Today queries
      db.promise().query(`
        SELECT IFNULL(SUM(pi.total),0) AS total
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE p.company_id = ?
        AND p.date = CURDATE()
      `, [companyId]),

      db.promise().query(`
        SELECT IFNULL(SUM(ei.total),0) AS total
        FROM exports e
        JOIN export_items ei ON e.id = ei.export_id
        WHERE e.company_id = ?
        AND e.date = CURDATE()
      `, [companyId]),

      // Month queries
      db.promise().query(`
        SELECT IFNULL(SUM(pi.total),0) AS total
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE p.company_id = ?
        AND DATE_FORMAT(p.date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
      `, [companyId]),

      db.promise().query(`
        SELECT IFNULL(SUM(ei.total),0) AS total
        FROM exports e
        JOIN export_items ei ON e.id = ei.export_id
        WHERE e.company_id = ?
        AND DATE_FORMAT(e.date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
      `, [companyId]),

      // Total purchase with optional date filter
      db.promise().query(`
        SELECT IFNULL(SUM(pi.total),0) AS total
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        WHERE p.company_id = ? ${totalDateFilter}
      `, totalParams),

      // Total sales with optional date filter
      db.promise().query(`
        SELECT IFNULL(SUM(ei.total),0) AS total
        FROM exports e
        JOIN export_items ei ON e.id = ei.export_id
        WHERE e.company_id = ? ${totalDateFilter}
      `, totalParams),

      // Vendor payments with optional date filter
      db.promise().query(`
        SELECT IFNULL(SUM(amount),0) AS total
        FROM vendor_payments
        WHERE company_id = ? ${paymentDateFilter}
      `, paymentParams),

      // Customer payments with optional date filter
      db.promise().query(`
        SELECT IFNULL(SUM(amount),0) AS total
        FROM customer_payments
        WHERE company_id = ? ${paymentDateFilter}
      `, paymentParams),

      // Recent activity - fixed UNION with GROUP BY
      db.promise().query(`
        SELECT * FROM (
          SELECT
            'purchases' AS type,
            v.name AS name,
            SUM(pi.total) AS amount,
            p.date AS date
          FROM purchases p
          JOIN vendors v ON p.vendor_id = v.id
          JOIN purchase_items pi ON p.id = pi.purchase_id
          WHERE p.company_id = ?
          GROUP BY p.id

          UNION ALL

          SELECT
            'sales' AS type,
            c.name AS name,
            SUM(ei.total) AS amount,
            e.date AS date
          FROM exports e
          JOIN customers c ON e.customer_id = c.id
          JOIN export_items ei ON e.id = ei.export_id
          WHERE e.company_id = ?
          GROUP BY e.id

          UNION ALL

          SELECT
            'vendor_payment' AS type,
            v.name AS name,
            vp.amount AS amount,
            vp.date AS date
          FROM vendor_payments vp
          JOIN vendors v ON vp.vendor_id = v.id
          WHERE vp.company_id = ?

          UNION ALL

          SELECT
            'customer_payment' AS type,
            c.name AS name,
            cp.amount AS amount,
            cp.date AS date
          FROM customer_payments cp
          JOIN customers c ON cp.customer_id = c.id
          WHERE cp.company_id = ?

        ) activity
        ORDER BY date DESC
        LIMIT 5
      `, [companyId, companyId, companyId, companyId]),

      // Top 5 buyers
      db.promise().query(`
        SELECT c.name, IFNULL(SUM(ei.total),0) AS total_sales
        FROM exports e
        JOIN export_items ei ON e.id = ei.export_id
        JOIN customers c ON e.customer_id = c.id
        WHERE e.company_id = ?
        GROUP BY e.customer_id
        ORDER BY total_sales DESC
        LIMIT 5
      `, [companyId]),

      // Top 5 suppliers
      db.promise().query(`
        SELECT v.name, IFNULL(SUM(pi.total),0) AS total_purchase
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        JOIN vendors v ON p.vendor_id = v.id
        WHERE p.company_id = ?
        GROUP BY p.vendor_id
        ORDER BY total_purchase DESC
        LIMIT 5
      `, [companyId])
    ]);

    res.json({
      raw_stock: Number(rawStock[0].total),
      final_stock: Number(finalStock[0].total),

      today_purchase_cost: Number(todayPurchase[0].total),
      today_sales_revenue: Number(todaySales[0].total),
      today_profit: isEmployee ? null : Number(todaySales[0].total) - Number(todayPurchase[0].total),

      month_purchase_cost: Number(monthPurchase[0].total),
      month_sales_revenue: Number(monthSales[0].total),
      month_profit: isEmployee ? null : Number(monthSales[0].total) - Number(monthPurchase[0].total),

      total_purchase: Number(totalPurchase[0].total),
      total_sales: Number(totalSales[0].total),
      gross_profit: isEmployee ? null : Number(totalSales[0].total) - Number(totalPurchase[0].total),

      vendor_payable: isEmployee ? null : (Number(totalPurchase[0].total) - Number(vendorPayments[0].total)),

      customer_receivable: isEmployee ? null : (Number(totalSales[0].total) - Number(customerPayments[0].total)),

      top_5_buyers: topBuyers,
      top_5_suppliers: topSuppliers,

      recent_activity: isEmployee ? null : recentActivity
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;