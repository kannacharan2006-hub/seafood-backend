const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* =========================================
LIST PURCHASES (Paginated)
========================================= */

router.get('/', verifyToken, async (req, res) => {

const companyId = req.user.company_id;
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const offset = (page - 1) * limit;

try {

const [countResult] = await db.promise().query(
  `SELECT COUNT(*) as total FROM purchases WHERE company_id = ?`,
  [companyId]
);
const totalItems = countResult[0].total;
const totalPages = Math.ceil(totalItems / limit);

const [results] = await db.promise().query(`
SELECT
p.id AS purchase_id,
p.date,
p.total_amount,
ven.name AS vendor_name,
u.name AS created_by
FROM purchases p
JOIN vendors ven ON p.vendor_id = ven.id
JOIN users u ON p.created_by = u.id
WHERE p.company_id = ?
ORDER BY p.date DESC, p.id DESC
LIMIT ? OFFSET ?
`, [companyId, limit, offset]);

res.json({
  data: results,
  pagination: {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  }
});

} catch (error) {

res.status(500).json({ error: error.message });

}

});


/* =========================================
PURCHASE DETAILS
========================================= */

router.get('/:id', verifyToken, async (req, res) => {

const companyId = req.user.company_id;
const purchaseId = req.params.id;

try {

const [header] = await db.promise().query(`
SELECT
p.id AS purchase_id,
p.date,
p.total_amount,
ven.name AS vendor_name,
u.name AS created_by
FROM purchases p
JOIN vendors ven ON p.vendor_id = ven.id
JOIN users u ON p.created_by = u.id
WHERE p.id = ?
AND p.company_id = ?
`, [purchaseId, companyId]);

if (header.length === 0) {

return res.status(404).json({
message: "Purchase not found"
});

}


/* Purchase items */

const [items] = await db.promise().query(`
SELECT
i.name AS item_name,
var.variant_name,
pi.quantity,
pi.price_per_kg,
pi.total
FROM purchase_items pi
JOIN variants var ON pi.variant_id = var.id
JOIN items i ON var.item_id = i.id
WHERE pi.purchase_id = ?
AND pi.company_id = ?
`, [purchaseId, companyId]);


res.json({
...header[0],
items
});

} catch (error) {

res.status(500).json({ error: error.message });

}

});


module.exports = router;