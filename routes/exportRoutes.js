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

const [variantCheck] = await connection.query(
`SELECT id FROM variants WHERE id=? AND company_id=?`,
[variant_id, companyId]
);

if (!variantCheck.length) throw new Error("Invalid variant");

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

    const safeItems = items.map(item => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      price_per_kg: parseFloat(item.price_per_kg) || 0,
      total: parseFloat(item.total) || 0
    }));

    const subTotal = safeItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subTotal * 0.18;
    const grandTotal = subTotal + taxAmount;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${items[0].invoice_no}.pdf"`);
    
    const doc = new PDFDocument({ size: 'A4', margin: 35 });
    doc.pipe(res);

    // 🎨 SIMPLIFIED HEADER (More compact)
    doc.fontSize(20).fillColor('#1e2937').text('SEAFOOD PRO', 45, 25);
    doc.fontSize(9).fillColor('#6b7280').text('Export Quality Seafood', 45, 42);

    // 📱 ULTRA-CLEAR INVOICE INFO (Bigger fonts)
    doc.fontSize(32).fillColor('#111827').text('INVOICE', 45, 80);
    
    doc.fontSize(14).fillColor('#374151')
       .text(`INV-${items[0].invoice_no}`, 420, 85, { width: 140, align: 'right' })
       .text(new Date(items[0].date).toLocaleDateString('en-IN'), 420, 108, { width: 140, align: 'right' })
       .text('Due: 30 Days', 420, 131, { width: 140, align: 'right' });

    // 📐 COMPACT BILLING (Tighter spacing)
    const billY = 155;
    doc.rect(45, billY, 190, 45).fillColor('#fafbfc').strokeColor('#e2e8f0').stroke();
    doc.rect(265, billY, 280, 45).fillColor('#fafbfc').strokeColor('#e2e8f0').stroke();

    doc.fontSize(11).fillColor('#1e2937')
       .text('FROM', 50, billY+7)
       .text('Seafood Export Co.', 50, billY+22)
       .fontSize(9).text('GST: 27ABCDE1234F1Z5', 50, billY+35);

    doc.text('TO', 270, billY+7);
    doc.fontSize(11).fillColor('#1f2937').text(items[0].customer_name || 'Customer', 270, billY+22);
    if (items[0].customer_phone) 
      doc.fontSize(9).fillColor('#6b7280').text(items[0].customer_phone, 270, billY+35);

    // 📊 SIMPLIFIED TABLE (Bigger cells)
    const tableY = 215;
    doc.rect(45, tableY, 505, 30).fillColor('#f8fafc').strokeColor('#d1d5db').stroke();
    
    doc.fontSize(13).fillColor('#1f2937')
       .text('Description', 55, tableY+9)
       .text('QTY', 300, tableY+9)
       .text('RATE/KG', 360, tableY+9)
       .text('TOTAL', 460, tableY+9);

    // 📱 PERFECT ROWS (48px height - mobile thumb friendly)
    let rowY = tableY + 38;
    safeItems.forEach((item, index) => {
      doc.rect(45, rowY, 505, 48).strokeColor('#f0f2f5').lineWidth(0.5).stroke();
      
      doc.fillColor('#1f2937').fontSize(12)
         .text(item.item_name.substring(0, 28), 55, rowY+10)
         .fontSize(11).fillColor('#6b7280').text(item.variant_name || 'Premium', 55, rowY+25)
         .fontSize(12).fillColor('#1f2937')
         .text(item.quantity.toFixed(2), 315, rowY+18, { width: 35, align: 'right' })
         .text(`₹${item.price_per_kg.toFixed(2)}`, 385, rowY+18, { width: 45, align: 'right' })
         .text(`₹${item.total.toFixed(2)}`, 475, rowY+18, { width: 65, align: 'right' });
      
      rowY += 52;
    });

    // 💎 ENHANCED TOTAL SECTION (Full width)
    const totalY = rowY + 25;
    doc.rect(45, totalY, 505, 70).fillColor('#f9fafb').strokeColor('#cbd5e1').lineWidth(2).stroke();
    
    doc.fontSize(14).fillColor('#374151')
       .text('SUBTOTAL', 55, totalY+18)
       .text(`₹${subTotal.toFixed(2)}`, 485, totalY+18, { width: 55, align: 'right' })
       .text('GST 18%', 55, totalY+38)
       .text(`₹${taxAmount.toFixed(2)}`, 485, totalY+38, { width: 55, align: 'right' });

    // GRAND TOTAL (Bigger + Bolder)
    doc.rect(45, totalY+55, 505, 15).fillColor('#059669').stroke();
    doc.fontSize(16).fillColor('white').text('GRAND TOTAL', 55, totalY+58);
    doc.fontSize(22).fillColor('white')
       .text(`₹${grandTotal.toFixed(2)}`, 475, totalY+55, { width: 70, align: 'right' });

    // ✅ CLEAN SIGNATURE
    const sigY = totalY + 85;
    doc.moveTo(45, sigY+5).lineTo(550, sigY+5).lineWidth(2).strokeColor('#d1d5db').stroke();
    doc.fontSize(12).fillColor('#9ca3af').text('Authorized Signature', 275, sigY+22, { 
      width: 200, align: 'center' 
    });

    // 📲 PERFECT FOOTER
    const footerY = 760;
    doc.rect(0, footerY, 595, 32).fillColor('#f8fafc').strokeColor('#e5e7eb').stroke();
    doc.fontSize(10).fillColor('#6b7280')
       .text('Seafood Pro ERP • Professional Seafood Export Solutions', 45, footerY+12);

    doc.end();

  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
});



module.exports = router;