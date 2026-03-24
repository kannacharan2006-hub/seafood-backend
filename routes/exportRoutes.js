const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');


/* =========================================
   CREATE EXPORT
========================================= */

router.post('/', verifyToken, async (req, res) => {

const companyId = req.user.company_id;
const userId = req.user.id;

const { customer_id, date, items } = req.body;

if (!customer_id || !date || !Array.isArray(items) || items.length === 0) {
return res.status(400).json({ message: "Invalid export data" });
}

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();

const invoice_no = "INV" + Date.now();

/* Validate customer */

const [customerCheck] = await connection.query(
`SELECT id FROM customers WHERE id=? AND company_id=?`,
[customer_id, companyId]
);

if (!customerCheck.length) throw new Error("Customer not found");

/* Insert export */

const [exportResult] = await connection.query(
`INSERT INTO exports
(customer_id, invoice_no, date, created_by, company_id)
VALUES (?,?,?,?,?)`,
[customer_id, invoice_no, date, userId, companyId]
);

const exportId = exportResult.insertId;

/* Process items */

for (const item of items) {

const variant_id = Number(item.variant_id);
const quantity = parseFloat(item.quantity);
const price = parseFloat(item.price_per_kg);

if (!variant_id || quantity <= 0 || price <= 0)
throw new Error("Invalid item data");

const total = Number((quantity * price).toFixed(2));

/* Validate variant */
/** 
const [variantCheck] = await connection.query(
`SELECT id FROM variants WHERE id=? AND company_id=?`,
[variant_id, companyId]
);

if (!variantCheck.length) throw new Error("Invalid variant");
**/
/* Deduct stock */

const [updateResult] = await connection.query(
`UPDATE final_stock
SET available_qty = available_qty - ?
WHERE variant_id = ?
AND company_id = ?
AND available_qty >= ?`,
[quantity, variant_id, companyId, quantity]
);

if (!updateResult.affectedRows)
throw new Error("Insufficient stock");

/* Insert export item */
await connection.query(
`INSERT INTO export_items
(export_id, variant_id, quantity, price_per_kg, total, company_id)
VALUES (?,?,?,?,?,?)`,
[exportId, variant_id, quantity, price, total, companyId]
);

}

await connection.commit();

res.status(201).json({
message: "Export successful",
invoice_no
});

} catch (error) {

await connection.rollback();
res.status(400).json({ error: error.message });

} finally {

connection.release();

}

});


/* =========================================
   DELETE EXPORT
========================================= */

router.delete('/:id', verifyToken, async (req, res) => {

const exportId = req.params.id;
const companyId = req.user.company_id;

const connection = await db.promise().getConnection();

try {

await connection.beginTransaction();

/* Verify export */

const [exportCheck] = await connection.query(
`SELECT id FROM exports WHERE id=? AND company_id=?`,
[exportId, companyId]
);

if (!exportCheck.length) throw new Error("Export not found");

/* Get items */

const [items] = await connection.query(
`SELECT variant_id, quantity
FROM export_items
WHERE export_id=? AND company_id=?`,
[exportId, companyId]
);
/* Restore stock */

for (const item of items) {

await connection.query(
`INSERT INTO final_stock (variant_id, available_qty, company_id)
VALUES (?,?,?)
ON DUPLICATE KEY UPDATE
available_qty = available_qty + VALUES(available_qty)`,
[item.variant_id, item.quantity, companyId]
);

}

/* Delete items */

await connection.query(
`DELETE FROM export_items WHERE export_id=? AND company_id=?`,
[exportId, companyId]
);

/* Delete export */

await connection.query(
`DELETE FROM exports WHERE id=? AND company_id=?`,
[exportId, companyId]
);

await connection.commit();

res.json({ message: "Export deleted & stock restored" });

} catch (error) {

await connection.rollback();
res.status(400).json({ error: error.message });

} finally {

connection.release();

}

});


/* =========================================
   GET EXPORTS
========================================= */

router.get('/', verifyToken, async (req, res) => {

const companyId = req.user.company_id;

try {

const [exports] = await db.promise().query(`
SELECT
e.id,
e.invoice_no,
e.date,
c.name AS customer_name,
u.name AS created_by
FROM exports e
LEFT JOIN customers c ON e.customer_id = c.id
LEFT JOIN users u ON e.created_by = u.id
WHERE e.company_id = ?
ORDER BY e.date DESC
`, [companyId]);

for (let exp of exports) {

const [items] = await db.promise().query(
`SELECT
i.name AS item_name,
v.variant_name,
ei.quantity,
ei.price_per_kg,
ei.total
FROM export_items ei
JOIN variants v ON ei.variant_id = v.id
JOIN items i ON v.item_id = i.id
WHERE ei.export_id=? AND ei.company_id=?`,
[exp.id, companyId]
);

exp.items = items;

}

res.json(exports);

} catch (error) {

res.status(500).json({ error: error.message });

}

});

/* =========================================
   INVOICE PDF
========================================= */
router.get('/invoice/:id', verifyToken, async (req, res) => {
  const exportId = req.params.id;
  const companyId = req.user.company_id;

  try {
    // Get export with items
    const [items] = await db.promise().query(`
      SELECT e.invoice_no, e.date, c.name AS customer_name, c.address AS customer_address, 
             c.phone AS customer_phone, i.name AS item_name, v.variant_name, 
             ei.quantity, ei.price_per_kg, ei.total
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id JOIN items i ON v.item_id = i.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.id=? AND e.company_id=?`, [exportId, companyId]);

    if (!items.length)
      return res.status(404).json({ message: "Invoice not found" });

    // Get company details
    const [companies] = await db.promise().query(
      `SELECT name, phone, email FROM companies WHERE id = ?`, [companyId]
    );
    const company = companies[0] || {};

    // Calculate totals
    const safeItems = items.map(item => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      price_per_kg: parseFloat(item.price_per_kg) || 0,
      total: parseFloat(item.total) || 0
    }));

    const subTotal = safeItems.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = subTotal;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${items[0].invoice_no}.pdf"`);
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    // Colors
    const primaryColor = '#1e3a5f';
    const accentColor = '#2563eb';
    const lightBg = '#f8fafc';
    const borderColor = '#e2e8f0';
    const textDark = '#1e293b';
    const textLight = '#64748b';

    // Header Background
    doc.rect(0, 0, 595, 100).fill(primaryColor);
    
    // Company Name
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
       .text(company.name || 'SEAFOOD PRO', 40, 25);
    
    // Company Contact
    doc.fontSize(10).font('Helvetica')
       .text(`${company.email || ''} | ${company.phone || ''}`, 40, 55);
    
    // INVOICE Label
    doc.fillColor(accentColor).fontSize(36).font('Helvetica-Bold')
       .text('INVOICE', 400, 30, { align: 'right' });
    doc.fillColor('white').fontSize(12)
       .text(`#${items[0].invoice_no}`, 400, 70, { align: 'right' });

    // Info Cards
    let y = 120;
    
    // Date Card
    doc.rect(40, y, 160, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9).font('Helvetica')
       .text('INVOICE DATE', 50, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(new Date(items[0].date).toLocaleDateString('en-IN', {
         day: '2-digit', month: 'short', year: 'numeric'
       }), 50, y+28);

    // Customer Card
    doc.rect(220, y, 335, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9)
       .text('BILLED TO', 230, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(items[0].customer_name || 'Customer', 230, y+28);
    if (items[0].customer_address) {
      doc.fillColor(textLight).fontSize(9)
         .text(items[0].customer_address.substring(0, 45), 230, y+45);
    }

    y += 80;

    // Table Header
    doc.rect(40, y, 515, 35).fill(primaryColor);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('ITEM', 50, y+12)
       .text('QTY (KG)', 300, y+12, { align: 'center' })
       .text('RATE/KG', 380, y+12, { align: 'center' })
       .text('AMOUNT', 480, y+12, { align: 'right' });

    y += 35;
    
    // Table Rows
    safeItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? 'white' : lightBg;
      doc.rect(40, y, 515, 45).fill(bgColor).stroke(borderColor);
      
      const itemName = item.item_name || 'Item';
      const variantName = item.variant_name || '';
      const displayName = variantName ? `${itemName} - ${variantName}` : itemName;
      
      doc.fillColor(textDark).fontSize(11).font('Helvetica')
         .text(displayName.substring(0, 35), 50, y+10)
         .text(item.quantity.toFixed(2), 300, y+10, { align: 'center' })
         .text(`₹${item.price_per_kg.toFixed(2)}`, 380, y+10, { align: 'center' })
         .text(`₹${item.total.toFixed(2)}`, 485, y+10, { align: 'right' });
      
      y += 45;
    });

    y += 20;

    // Total Section
    doc.rect(300, y, 255, 80).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(10).font('Helvetica')
       .text('Subtotal', 315, y+15)
       .text(`₹${subTotal.toFixed(2)}`, 480, y+15, { align: 'right' });
    
    y += 40;
    
    // Grand Total
    doc.rect(300, y, 255, 50).fill(primaryColor);
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
       .text('GRAND TOTAL', 315, y+18);
    doc.fontSize(18)
       .text(`₹${grandTotal.toFixed(2)}`, 380, y+16, { align: 'right' });

    y += 80;

    // Payment Info
    doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold')
       .text('Payment Terms', 40, y);
    doc.fillColor(textLight).fontSize(10).font('Helvetica')
       .text('Payment due within 30 days of invoice date.', 40, y+18);

    y += 50;

    // Footer Line
    doc.moveTo(40, y).lineTo(555, y).lineWidth(1).stroke(borderColor);
    
    y += 15;
    doc.fillColor(textLight).fontSize(9)
       .text(`${company.name || 'Company'} | All Rights Reserved`, 40, y, { align: 'center' })
       .text('Thank you for your business!', 40, y + 12, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
});




module.exports = router;