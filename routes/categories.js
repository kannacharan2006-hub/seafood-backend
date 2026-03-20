const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* ================= ALL CATEGORIES ================= */

router.get('/', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [rows] = await db.promise().query(
`SELECT id, name
FROM categories
WHERE company_id = ?
ORDER BY name`,
[companyId]
);

res.json(rows);

} catch (error) {

res.status(500).json({ error: error.message });

}

});

module.exports = router;