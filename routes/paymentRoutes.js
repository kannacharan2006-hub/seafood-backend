const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');
const { paymentValidation } = require('../config/validation');


/* ================= CUSTOMER PAYMENT ================= */

router.post('/customer-payment', verifyToken, paymentValidation.customerPayment, async (req, res) => {

const companyId = req.user.company_id;

try {

const { customer_id, amount } = req.body;

if (!customer_id || !amount || amount <= 0) {
return res.status(400).json({
message: "Valid customer_id and amount are required"
});
}

const [customer] = await db.promise().query(
`SELECT id FROM customers 
WHERE id = ? AND company_id = ?`,
[customer_id, companyId]
);

if (customer.length === 0) {
return res.status(404).json({ message: "Customer not found" });
}

await db.promise().query(`
INSERT INTO customer_payments
(customer_id, amount, date, company_id)
VALUES (?, ?, CURDATE(), ?)
`, [customer_id, amount, companyId]);

res.json({ message: "Customer payment recorded successfully" });

} catch (error) {

console.error("CUSTOMER PAYMENT ERROR:", error);
res.status(500).json({ message: error.message });

}

});


/* ================= CUSTOMER BALANCE ================= */

router.get('/customer-balance/:id', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const customerId = req.params.id;

const [result] = await db.promise().query(`
SELECT
c.name,
IFNULL(SUM(ei.total),0) AS total_sales,
IFNULL((
SELECT SUM(cp.amount)
FROM customer_payments cp
WHERE cp.customer_id = c.id
AND cp.company_id = ?
),0) AS total_paid
FROM customers c
LEFT JOIN exports e
ON e.customer_id = c.id AND e.company_id = ?
LEFT JOIN export_items ei
ON ei.export_id = e.id
WHERE c.id = ?
AND c.company_id = ?
GROUP BY c.id
`, [companyId, companyId, customerId, companyId]);

if (!result.length) {
return res.status(404).json({ message: "Customer not found" });
}

const data = result[0];

res.json({
customer_id: customerId,
customer_name: data.name,
totalSales: Number(data.total_sales),
totalPaid: Number(data.total_paid),
balance: Number(data.total_sales) - Number(data.total_paid)
});

} catch (error) {
console.error("CUSTOMER BALANCE ERROR:", error);
res.status(500).json({ message: error.message });

}

});


/* ================= VENDOR BALANCE ================= */

router.get('/vendor-balance/:id', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const vendorId = req.params.id;

const [result] = await db.promise().query(`
SELECT
v.name,
IFNULL(SUM(pi.total),0) AS total_purchase,
IFNULL((
SELECT SUM(vp.amount)
FROM vendor_payments vp
WHERE vp.vendor_id = v.id
AND vp.company_id = ?
),0) AS total_paid
FROM vendors v
LEFT JOIN purchases p
ON p.vendor_id = v.id AND p.company_id = ?
LEFT JOIN purchase_items pi
ON pi.purchase_id = p.id
WHERE v.id = ?
AND v.company_id = ?
GROUP BY v.id
`, [companyId, companyId, vendorId, companyId]);

if (!result.length) {
return res.status(404).json({ message: "Vendor not found" });
}

const data = result[0];

res.json({
vendor_id: vendorId,
vendor_name: data.name,
totalPurchase: Number(data.total_purchase),
totalPaid: Number(data.total_paid),
balance: Number(data.total_purchase) - Number(data.total_paid)
});

} catch (error) {

console.error("VENDOR BALANCE ERROR:", error);
res.status(500).json({ message: error.message });

}

});


/* ================= CUSTOMER PAYMENT HISTORY ================= */

router.get('/customer-payment-history/:id', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const customerId = req.params.id;

const [rows] = await db.promise().query(`
SELECT amount, date
FROM customer_payments
WHERE customer_id = ?
AND company_id = ?
ORDER BY date DESC
`, [customerId, companyId]);

res.json(rows);

} catch (error) {

res.status(500).json({ message: error.message });

}

});


/* ================= VENDOR PAYMENT ================= */

router.post('/vendor-payment', verifyToken, paymentValidation.vendorPayment, async (req, res) => {

const companyId = req.user.company_id;

try {

const { vendor_id, amount } = req.body;

if (!vendor_id || !amount || amount <= 0) {
return res.status(400).json({
message: "Valid vendor_id and amount are required"
});
}

const [vendor] = await db.promise().query(
`SELECT id FROM vendors
WHERE id = ? AND company_id = ?`,
[vendor_id, companyId]
);

if (vendor.length === 0) {
return res.status(404).json({ message: "Vendor not found" });
}

await db.promise().query(`
INSERT INTO vendor_payments
(vendor_id, amount, date, company_id)
VALUES (?, ?, CURDATE(), ?)
`, [vendor_id, amount, companyId]);

res.json({ message: "Vendor payment recorded successfully" });

} catch (error) {

console.error("VENDOR PAYMENT ERROR:", error);
res.status(500).json({ message: error.message });

}

});

module.exports = router;