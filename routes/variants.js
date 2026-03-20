const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* ================= ALL VARIANTS ================= */

router.get('/', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [rows] = await db.promise().query(
`SELECT
v.id,
c.name AS category,
i.name AS item_name,
v.variant_name AS grade
FROM variants v
JOIN items i ON v.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE v.company_id = ?
AND i.company_id = ?
AND c.company_id = ?
ORDER BY c.name, i.name, v.variant_name`,
[companyId, companyId, companyId]
);

res.json(rows);

} catch (error) {

res.status(500).json({ error: error.message });

}

});


/* ================= VARIANTS BY ITEM ================= */

router.get('/:itemId', verifyToken, async (req, res) => {

const companyId = req.user.company_id;
const itemId = req.params.itemId;

try {

/* Validate item belongs to company */

const [itemCheck] = await db.promise().query(
`SELECT id
FROM items
WHERE id = ?
AND company_id = ?`,
[itemId, companyId]
);

if (itemCheck.length === 0) {
return res.status(404).json({
message: "Item not found"
});
}


/* Fetch variants */

const [rows] = await db.promise().query(
`SELECT id, variant_name
FROM variants
WHERE item_id = ?
AND company_id = ?
ORDER BY variant_name`,
[itemId, companyId]
);

res.json(rows);

} catch (error) {

res.status(500).json({ error: error.message });

}

});

module.exports = router;