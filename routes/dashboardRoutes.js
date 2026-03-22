const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const db = require('../config/db');

router.get('/summary', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const { from, to } = req.query;

/* ================= STOCK ================= */

const [[raw]] = await db.promise().query(`
SELECT IFNULL(SUM(rs.available_qty),0) AS total
FROM raw_stock rs
JOIN variants v ON rs.variant_id = v.id
WHERE rs.company_id = ?
`, [companyId]);


const [[final]] = await db.promise().query(`
SELECT IFNULL(SUM(fs.available_qty),0) AS total
FROM final_stock fs
JOIN variants v ON fs.variant_id = v.id
WHERE fs.company_id = ?
`, [companyId]);


/* ================= TODAY ================= */

const [[todayPurchase]] = await db.promise().query(`
SELECT IFNULL(SUM(pi.total),0) AS total
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
WHERE p.company_id = ?
AND p.date = CURDATE()
`, [companyId]);

const [[todaySales]] = await db.promise().query(`
SELECT IFNULL(SUM(ei.total),0) AS total
FROM exports e
JOIN export_items ei ON e.id = ei.export_id
WHERE e.company_id = ?
AND e.date = CURDATE()
`, [companyId]);

/* ================= MONTH ================= */

const [[monthPurchase]] = await db.promise().query(`
SELECT IFNULL(SUM(pi.total),0) AS total
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
WHERE p.company_id = ?
AND DATE_FORMAT(p.date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
`, [companyId]);

const [[monthSales]] = await db.promise().query(`
SELECT IFNULL(SUM(ei.total),0) AS total
FROM exports e
JOIN export_items ei ON e.id = ei.export_id
WHERE e.company_id = ?
AND DATE_FORMAT(e.date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
`, [companyId]);

/* ================= TOTAL ================= */

let purchaseQuery = `
SELECT IFNULL(SUM(pi.total),0) AS total
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
WHERE p.company_id = ?
`;

let salesQuery = `
SELECT IFNULL(SUM(ei.total),0) AS total
FROM exports e
JOIN export_items ei ON e.id = ei.export_id
WHERE e.company_id = ?
`;

let params = [companyId];

if (from && to) {

purchaseQuery += " AND p.date BETWEEN ? AND ?";
salesQuery += " AND e.date BETWEEN ? AND ?";

params = [companyId, from, to];

}

const [[totalPurchase]] = await db.promise().query(purchaseQuery, params);
const [[totalSales]] = await db.promise().query(salesQuery, params);
/* ================= PAYMENTS ================= */

const [[vendorPayments]] = await db.promise().query(`
SELECT IFNULL(SUM(amount),0) AS total
FROM vendor_payments
WHERE company_id = ?
`, [companyId]);

const [[customerPayments]] = await db.promise().query(`
SELECT IFNULL(SUM(amount),0) AS total
FROM customer_payments
WHERE company_id = ?
`, [companyId]);

/* ================= RECENT ACTIVITY ================= */

const [recentActivity] = await db.promise().query(`
SELECT * FROM (

SELECT
'purchases' AS type,
v.name AS name,
p.total_amount AS amount,
p.date AS date
FROM purchases p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.company_id = ?

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
`, [companyId, companyId, companyId, companyId]);

/* ================= TOP 5 ================= */

const [topBuyers] = await db.promise().query(`
SELECT c.name, IFNULL(SUM(ei.total),0) AS total_sales
FROM exports e
JOIN export_items ei ON e.id = ei.export_id
JOIN customers c ON e.customer_id = c.id
WHERE e.company_id = ?
GROUP BY e.customer_id
ORDER BY total_sales DESC
LIMIT 5
`, [companyId]);

const [topSuppliers] = await db.promise().query(`
SELECT v.name, IFNULL(SUM(pi.total),0) AS total_purchase
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
JOIN vendors v ON p.vendor_id = v.id
WHERE p.company_id = ?
GROUP BY p.vendor_id
ORDER BY total_purchase DESC
LIMIT 5
`, [companyId]);

/* ================= RESPONSE ================= */

res.json({

total_raw_stock: Number(raw.total),
total_final_stock: Number(final.total),

today_purchase_cost: Number(todayPurchase.total),
today_sales_revenue: Number(todaySales.total),
today_profit: Number(todaySales.total) - Number(todayPurchase.total),

month_purchase_cost: Number(monthPurchase.total),
month_sales_revenue: Number(monthSales.total),
month_profit: Number(monthSales.total) - Number(monthPurchase.total),

total_purchase: Number(totalPurchase.total),
total_sales: Number(totalSales.total),
gross_profit: Number(totalSales.total) - Number(totalPurchase.total),

vendor_payable:
Number(totalPurchase.total) - Number(vendorPayments.total),

customer_receivable:
Number(totalSales.total) - Number(customerPayments.total),

top_5_buyers: topBuyers,
top_5_suppliers: topSuppliers,

recent_activity: recentActivity

});

} catch (error) {

res.status(500).json({ error: error.message });

}

});

module.exports = router;