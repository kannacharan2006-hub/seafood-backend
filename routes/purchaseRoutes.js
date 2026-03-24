const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');
const { purchaseValidation } = require('../config/validation');


/* =========================================
CREATE PURCHASE (TRANSACTION SAFE)
========================================= */

router.post('/', verifyToken, purchaseValidation.create, async (req, res) => {

if (!['OWNER','EMPLOYEE'].includes(req.user.role)) {
return res.status(403).json({ message: 'Access denied' });
}

const companyId = req.user.company_id;
const userId = req.user.id;

const { vendor_id, supplier_type, date, items } = req.body;

if (!vendor_id || !date || !Array.isArray(items) || items.length === 0) {
return res.status(400).json({ message: "Invalid purchase data" });
}

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();


/* 1️⃣ Validate vendor belongs to company */

const [vendorCheck] = await connection.query(
`SELECT id FROM vendors
 WHERE id = ? AND company_id = ?`,
[vendor_id, companyId]
);

if (vendorCheck.length === 0) {
throw new Error("Vendor not found");
}

/* 2️⃣ Insert purchase header */

const [purchaseResult] = await connection.query(
`INSERT INTO purchases
(vendor_id, supplier_type, date, created_by, company_id, total_amount)
VALUES (?, ?, ?, ?, ?, 0)`,
[vendor_id, supplier_type || null, date, userId, companyId]
);

const purchaseId = purchaseResult.insertId;

let grandTotal = 0;


/* 3️⃣ Insert items + Update raw stock */

for (const item of items) {

const variant_id = Number(item.variant_id);
const quantity = parseFloat(item.quantity);
const price = parseFloat(item.price_per_kg);

if (!variant_id || quantity <= 0 || price <= 0) {
throw new Error("Invalid item data");
}

const total = Number((quantity * price).toFixed(2));
grandTotal += total;


/* Validate variant belongs to company */
/** 
const [variantCheck] = await connection.query(
`SELECT id FROM variants
 WHERE id = ? AND company_id = ?`,
[variant_id, companyId]
);

if (variantCheck.length === 0) {
throw new Error("Invalid variant selected");
}
*/
/* Insert purchase items */

await connection.query(
`INSERT INTO purchase_items
(purchase_id, variant_id, quantity, price_per_kg, total, company_id)
VALUES (?, ?, ?, ?, ?, ?)`,
[
purchaseId,
variant_id,
quantity,
price,
total,
companyId
]
);


/* Update raw stock */

await connection.query(
`INSERT INTO raw_stock (variant_id, available_qty, company_id)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
available_qty = available_qty + VALUES(available_qty)`,
[variant_id, quantity, companyId]
);

}


/* 4️⃣ Update purchase total */

await connection.query(
`UPDATE purchases
 SET total_amount = ?
 WHERE id = ?`,
[grandTotal, purchaseId]
);

await connection.commit();

res.status(201).json({
message: "Purchase saved successfully"
});

} catch (error) {

await connection.rollback();
res.status(400).json({ error: error.message });

} finally {

connection.release();

}

});

/* =========================================
DELETE PURCHASE
========================================= */

router.delete('/:id', verifyToken, async (req, res) => {

if (req.user.role !== 'OWNER') {
return res.status(403).json({ message: "Only Owner can delete purchase" });
}

const purchaseId = req.params.id;
const companyId = req.user.company_id;

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();


/* Verify purchase belongs to company */

const [purchaseCheck] = await connection.query(
`SELECT id FROM purchases
 WHERE id = ? AND company_id = ?`,
[purchaseId, companyId]
);

if (purchaseCheck.length === 0) {
throw new Error("Purchase not found");
}


/* Get purchase items */

const [items] = await connection.query(
`SELECT variant_id, quantity
 FROM purchase_items
 WHERE purchase_id = ?
 AND company_id = ?`,
[purchaseId, companyId]
);


/* Reverse raw stock */

for (const item of items) {

const qty = parseFloat(item.quantity);

const [updateResult] = await connection.query(
`UPDATE raw_stock
 SET available_qty = available_qty - ?
 WHERE variant_id = ?
 AND company_id = ?
 AND available_qty >= ?`,
[qty, item.variant_id, companyId, qty]
);

if (updateResult.affectedRows === 0) {
throw new Error("Cannot delete. Raw stock already consumed.");
}

}


/* Delete items */

await connection.query(
`DELETE FROM purchase_items
 WHERE purchase_id = ?
 AND company_id = ?`,
[purchaseId, companyId]
);


/* Delete purchase */

await connection.query(
`DELETE FROM purchases
 WHERE id = ?
 AND company_id = ?`,
[purchaseId, companyId]
);

await connection.commit();

res.json({
message: "Purchase deleted safely"
});

} catch (error) {

await connection.rollback();
res.status(400).json({ error: error.message });

} finally {

connection.release();

}

});

module.exports = router;