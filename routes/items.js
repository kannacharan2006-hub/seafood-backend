const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* ================= ITEMS BY CATEGORY ================= */

router.get('/:categoryId', verifyToken, async (req, res) => {

try {

const categoryId = req.params.categoryId;
const companyId = req.user.company_id;


/* 1️⃣ Validate category belongs to company */

const [categoryCheck] = await db.promise().query(
`SELECT id
FROM categories
WHERE id = ?
AND company_id = ?`,
[categoryId, companyId]
);

if (categoryCheck.length === 0) {
return res.status(404).json({
message: "Category not found"
});
}


/* 2️⃣ Fetch items */

const [rows] = await db.promise().query(
`SELECT id, name
FROM items
WHERE category_id = ?
AND company_id = ?
ORDER BY name`,
[categoryId, companyId]
);

res.json(rows);

} catch (error) {

res.status(500).json({ error: error.message });

}

});

module.exports = router;