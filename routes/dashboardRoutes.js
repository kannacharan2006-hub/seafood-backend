const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied. Only owners can access this data.');
  }
  next();
};

router.get('/summary', verifyToken, async (req, res) => {
  const companyId = req.user.company_id;
  const isEmployee = req.user.role === 'EMPLOYEE';
  const { from, to } = req.query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !dateRegex.test(from)) || (to && !dateRegex.test(to))) {
    return ApiResponse.error(res, 'Invalid date format. Use YYYY-MM-DD', 400);
  }

  try {
    const [paymentDateFilter, paymentParams, totalDateFilter, totalParams] = buildDateFilters(from, to, companyId);

    const [
      rawStock, finalStock, todayPurchase, todaySales,
      monthPurchase, monthSales, totalPurchase, totalSales,
      vendorPayments, customerPayments, recentActivity,
      topBuyers, topSuppliers
    ] = await Promise.all([
      Database.getOne('SELECT IFNULL(SUM(rs.available_qty),0) AS total FROM raw_stock rs WHERE rs.company_id = ?', [companyId]),
      Database.getOne('SELECT IFNULL(SUM(fs.available_qty),0) AS total FROM final_stock fs WHERE fs.company_id = ?', [companyId]),
      Database.getOne('SELECT IFNULL(SUM(pi.total),0) AS total FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE p.company_id = ? AND p.date = CURDATE()', [companyId]),
      Database.getOne('SELECT IFNULL(SUM(ei.total),0) AS total FROM exports e JOIN export_items ei ON e.id = ei.export_id WHERE e.company_id = ? AND e.date = CURDATE()', [companyId]),
      Database.getOne('SELECT IFNULL(SUM(pi.total),0) AS total FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE p.company_id = ? AND DATE_FORMAT(p.date,"%Y-%m") = DATE_FORMAT(CURDATE(),"%Y-%m")', [companyId]),
      Database.getOne('SELECT IFNULL(SUM(ei.total),0) AS total FROM exports e JOIN export_items ei ON e.id = ei.export_id WHERE e.company_id = ? AND DATE_FORMAT(e.date,"%Y-%m") = DATE_FORMAT(CURDATE(),"%Y-%m")', [companyId]),
      Database.getOne(`SELECT IFNULL(SUM(pi.total),0) AS total FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id WHERE p.company_id = ? ${totalDateFilter}`, totalParams),
      Database.getOne(`SELECT IFNULL(SUM(ei.total),0) AS total FROM exports e JOIN export_items ei ON e.id = ei.export_id WHERE e.company_id = ? ${totalDateFilter}`, totalParams),
      Database.getOne(`SELECT IFNULL(SUM(amount),0) AS total FROM vendor_payments WHERE company_id = ? ${paymentDateFilter}`, paymentParams),
      Database.getOne(`SELECT IFNULL(SUM(amount),0) AS total FROM customer_payments WHERE company_id = ? ${paymentDateFilter}`, paymentParams),
      Database.getAll(`
        SELECT * FROM (
          SELECT 'purchases' AS type, v.name AS name, SUM(pi.total) AS amount, p.date AS date
          FROM purchases p JOIN vendors v ON p.vendor_id = v.id JOIN purchase_items pi ON p.id = pi.purchase_id
          WHERE p.company_id = ? GROUP BY p.id
          UNION ALL
          SELECT 'sales' AS type, c.name AS name, SUM(ei.total) AS amount, e.date AS date
          FROM exports e JOIN customers c ON e.customer_id = c.id JOIN export_items ei ON e.id = ei.export_id
          WHERE e.company_id = ? GROUP BY e.id
          UNION ALL
          SELECT 'vendor_payment' AS type, v.name AS name, vp.amount AS amount, vp.date AS date
          FROM vendor_payments vp JOIN vendors v ON vp.vendor_id = v.id WHERE vp.company_id = ?
          UNION ALL
          SELECT 'customer_payment' AS type, c.name AS name, cp.amount AS amount, cp.date AS date
          FROM customer_payments cp JOIN customers c ON cp.customer_id = c.id WHERE cp.company_id = ?
        ) activity ORDER BY date DESC LIMIT 5
      `, [companyId, companyId, companyId, companyId]),
      Database.getAll('SELECT c.name, IFNULL(SUM(ei.total),0) AS total_sales FROM exports e JOIN export_items ei ON e.id = ei.export_id JOIN customers c ON e.customer_id = c.id WHERE e.company_id = ? GROUP BY e.customer_id ORDER BY total_sales DESC LIMIT 5', [companyId]),
      Database.getAll('SELECT v.name, IFNULL(SUM(pi.total),0) AS total_purchase FROM purchases p JOIN purchase_items pi ON p.id = pi.purchase_id JOIN vendors v ON p.vendor_id = v.id WHERE p.company_id = ? GROUP BY p.vendor_id ORDER BY total_purchase DESC LIMIT 5', [companyId])
    ]);

    res.json({
      success: true,
      raw_stock: Number(rawStock.total),
      final_stock: Number(finalStock.total),
      today_purchase_cost: Number(todayPurchase.total),
      today_sales_revenue: Number(todaySales.total),
      today_profit: isEmployee ? null : Number(todaySales.total) - Number(todayPurchase.total),
      month_purchase_cost: Number(monthPurchase.total),
      month_sales_revenue: Number(monthSales.total),
      month_profit: isEmployee ? null : Number(monthSales.total) - Number(monthPurchase.total),
      total_purchase: Number(totalPurchase.total),
      total_sales: Number(totalSales.total),
      gross_profit: isEmployee ? null : Number(totalSales.total) - Number(totalPurchase.total),
      vendor_payable: isEmployee ? null : (Number(totalPurchase.total) - Number(vendorPayments.total)),
      customer_receivable: isEmployee ? null : (Number(totalSales.total) - Number(customerPayments.total)),
      top_5_buyers: topBuyers,
      top_5_suppliers: topSuppliers,
      recent_activity: isEmployee ? null : recentActivity
    });
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

function buildDateFilters(from, to, companyId) {
  let paymentDateFilter = '', paymentParams = [companyId];
  let totalDateFilter = '', totalParams = [companyId];
  
  if (from && to) {
    paymentDateFilter = ' AND date BETWEEN ? AND ? ';
    paymentParams = [companyId, from, to];
    totalDateFilter = ' AND date BETWEEN ? AND ? ';
    totalParams = [companyId, from, to];
  }
  
  return [paymentDateFilter, paymentParams, totalDateFilter, totalParams];
}

module.exports = router;
