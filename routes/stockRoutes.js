const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* ================= RAW STOCK ================= */

router.get('/raw-stock', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [rows] = await db.promise().query(
`SELECT
i.name AS item_name,
v.variant_name,
c.name AS category_name,
rs.available_qty
FROM raw_stock rs
JOIN variants v ON rs.variant_id = v.id
JOIN items i ON v.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE rs.available_qty > 0
AND rs.company_id = ?
AND v.company_id = ?
AND i.company_id = ?
AND c.company_id = ?`,
[companyId, companyId, companyId, companyId]
);

res.json(rows);

} catch (error) {

console.error("RAW STOCK ERROR:", error);

res.status(500).json({ error: error.message });

}

});


/* ================= FINAL STOCK ================= */

router.get('/final-stock', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [rows] = await db.promise().query(
`SELECT
i.name AS item_name,
v.variant_name,
c.name AS category_name,
fs.available_qty
FROM final_stock fs
JOIN variants v ON fs.variant_id = v.id
JOIN items i ON v.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE fs.available_qty > 0
AND fs.company_id = ?
AND v.company_id = ?
AND i.company_id = ?
AND c.company_id = ?`,
[companyId, companyId, companyId, companyId]
);

res.json(rows);

} catch (error) {

console.error("FINAL STOCK ERROR:", error);

res.status(500).json({ error: error.message });

}

});


module.exports = router;