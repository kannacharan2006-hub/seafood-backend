const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* =========================================
CREATE CONVERSION (RAW → FINAL)
========================================= */

router.post('/convert', verifyToken, async (req, res) => {

const companyId = req.user.company_id;
const userId = req.user.id;

const { raw_items, final_items, date, notes } = req.body;

if (!Array.isArray(raw_items) || raw_items.length === 0 ||
!Array.isArray(final_items) || final_items.length === 0) {

return res.status(400).json({ message: "Invalid conversion data" });

}

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();


/* 1️⃣ INSERT CONVERSION HEADER */

const [conversionResult] = await connection.query(
`INSERT INTO conversion
(date, notes, created_by, company_id)
VALUES (?, ?, ?, ?)`,
[date, notes || null, userId, companyId]
);

const conversionId = conversionResult.insertId;


/* 2️⃣ PROCESS RAW ITEMS */

for (const item of raw_items) {

const variant_id = Number(item.variant_id);
const quantity = parseFloat(item.quantity);

if (!variant_id || quantity <= 0) {
throw new Error("Invalid raw item data");
}

/* Validate variant */

const [variantCheck] = await connection.query(
`SELECT id
FROM variants
WHERE id = ? AND company_id = ?`,
[variant_id, companyId]
);

if (variantCheck.length === 0) {
throw new Error("Invalid variant selected");
}


/* Lock raw stock */

const [stockRows] = await connection.query(
`SELECT available_qty
FROM raw_stock
WHERE variant_id = ?
AND company_id = ?
FOR UPDATE`,
[variant_id, companyId]
);

if (stockRows.length === 0) {
throw new Error("Raw stock not found");
}

if (stockRows[0].available_qty < quantity) {
throw new Error("Insufficient raw stock");
}


/* Deduct raw stock */

await connection.query(
`UPDATE raw_stock
SET available_qty = available_qty - ?
WHERE variant_id = ?
AND company_id = ?`,
[quantity, variant_id, companyId]
);


/* Insert conversion input */

await connection.query(
`INSERT INTO conversion_inputs
(conversion_id, variant_id, quantity, company_id)
VALUES (?, ?, ?, ?)`,
[conversionId, variant_id, quantity, companyId]
);

}

/* 3️⃣ PROCESS FINAL ITEMS */

for (const item of final_items) {

const variant_id = Number(item.variant_id);
const quantity = parseFloat(item.quantity);

if (!variant_id || quantity <= 0) {
throw new Error("Invalid final item data");
}


/* Validate variant */

const [variantCheck] = await connection.query(
`SELECT id
FROM variants
WHERE id = ? AND company_id = ?`,
[variant_id, companyId]
);

if (variantCheck.length === 0) {
throw new Error("Invalid variant selected");
}


/* Update final stock */

await connection.query(
`INSERT INTO final_stock
(variant_id, available_qty, company_id)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
available_qty = available_qty + VALUES(available_qty)`,
[variant_id, quantity, companyId]
);


/* Insert conversion output */

await connection.query(
`INSERT INTO conversion_outputs
(conversion_id, variant_id, quantity, company_id)
VALUES (?, ?, ?, ?)`,
[conversionId, variant_id, quantity, companyId]
);

}

await connection.commit();

res.status(201).json({
message: "Conversion completed successfully"
});

} catch (error) {

await connection.rollback();

res.status(400).json({
error: error.message
});

} finally {

connection.release();

}

});


/* =========================================
DELETE CONVERSION
========================================= */

router.delete('/convert/:id', verifyToken, async (req, res) => {

const conversionId = Number(req.params.id);
const companyId = req.user.company_id;

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();


/* Verify conversion */

const [check] = await connection.query(
`SELECT id
FROM conversion
WHERE id = ?
AND company_id = ?`,
[conversionId, companyId]
);

if (check.length === 0) {
throw new Error("Conversion not found");
}


/* Lock inputs */

const [inputs] = await connection.query(
`SELECT variant_id, quantity
FROM conversion_inputs
WHERE conversion_id = ?
AND company_id = ?
FOR UPDATE`,
[conversionId, companyId]
);

/* Lock outputs */

const [outputs] = await connection.query(
`SELECT variant_id, quantity
FROM conversion_outputs
WHERE conversion_id = ?
AND company_id = ?
FOR UPDATE`,
[conversionId, companyId]
);


/* Restore raw stock */

for (const row of inputs) {

await connection.query(
`INSERT INTO raw_stock
(variant_id, available_qty, company_id)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
available_qty = available_qty + VALUES(available_qty)`,
[row.variant_id, row.quantity, companyId]
);

}


/* Deduct final stock */

for (const row of outputs) {

const [stockRows] = await connection.query(
`SELECT available_qty
FROM final_stock
WHERE variant_id = ?
AND company_id = ?
FOR UPDATE`,
[row.variant_id, companyId]
);

if (stockRows.length === 0 ||
stockRows[0].available_qty < row.quantity) {

throw new Error("Cannot delete. Final stock already used.");

}

await connection.query(
`UPDATE final_stock
SET available_qty = available_qty - ?
WHERE variant_id = ?
AND company_id = ?`,
[row.quantity, row.variant_id, companyId]
);

}


/* Delete children */

await connection.query(
`DELETE FROM conversion_inputs
WHERE conversion_id = ?
AND company_id = ?`,
[conversionId, companyId]
);

await connection.query(
`DELETE FROM conversion_outputs
WHERE conversion_id = ?
AND company_id = ?`,
[conversionId, companyId]
);


/* Delete header */

await connection.query(
`DELETE FROM conversion
WHERE id = ?
AND company_id = ?`,
[conversionId, companyId]
);

await connection.commit();

res.json({
message: "Conversion deleted and stock reversed successfully"
});

} catch (error) {

await connection.rollback();

res.status(400).json({
error: error.message
});

} finally {

connection.release();

}

});

/* =========================================
GET CONVERSION HISTORY
========================================= */

router.get('/convert', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [conversions] = await db.promise().query(
`SELECT
c.id,
c.date,
c.notes,
u.name AS created_by
FROM conversion c
JOIN users u ON c.created_by = u.id
WHERE c.company_id = ?
ORDER BY c.date DESC, c.id DESC`,
[companyId]
);

for (let conv of conversions) {

const [inputs] = await db.promise().query(
`SELECT
ci.variant_id,
v.variant_name,
ci.quantity
FROM conversion_inputs ci
JOIN variants v ON ci.variant_id = v.id
WHERE ci.conversion_id = ?
AND ci.company_id = ?`,
[conv.id, companyId]
);

const [outputs] = await db.promise().query(
`SELECT
co.variant_id,
v.variant_name,
co.quantity
FROM conversion_outputs co
JOIN variants v ON co.variant_id = v.id
WHERE co.conversion_id = ?
AND co.company_id = ?`,
[conv.id, companyId]
);

conv.raw_items = inputs;
conv.final_items = outputs;

}

res.json(conversions);

} catch (error) {

res.status(500).json({
error: error.message
});

}

});

module.exports = router;