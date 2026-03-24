const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');
const { exportValidation } = require('../config/validation');
const ExportService = require('../services/exportService');

/**
 * @swagger
 * /api/exports:
 *   post:
 *     summary: Create a new export/sale
 *     tags: [Exports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - date
 *               - items
 *             properties:
 *               customer_id:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ExportItem'
 *     responses:
 *       201:
 *         description: Export created successfully
 */
router.post('/', verifyToken, exportValidation.create, async (req, res) => {
  try {
    const { customer_id, date, items } = req.body;
    const result = await ExportService.createExport(
      req.user.id,
      req.user.company_id,
      customer_id,
      date,
      items
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/exports/{id}:
 *   delete:
 *     summary: Delete an export and restore stock
 *     tags: [Exports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Export deleted and stock restored
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await ExportService.deleteExport(
      req.params.id,
      req.user.company_id
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/exports:
 *   get:
 *     summary: Get all exports (paginated)
 *     tags: [Exports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of exports with pagination
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await ExportService.getExports(req.user.company_id, page, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/exports/invoice/{id}:
 *   get:
 *     summary: Download invoice PDF
 *     tags: [Exports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: PDF invoice file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/invoice/:id', verifyToken, async (req, res) => {
  try {
    const { items, company, grandTotal } = await ExportService.getInvoiceData(
      req.params.id,
      req.user.company_id
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${items[0].invoice_no}.pdf"`);
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const primaryColor = '#1e3a5f';
    const accentColor = '#2563eb';
    const lightBg = '#f8fafc';
    const borderColor = '#e2e8f0';
    const textDark = '#1e293b';
    const textLight = '#64748b';

    doc.rect(0, 0, 595, 100).fill(primaryColor);
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
       .text(company.name || 'SEAFOOD PRO', 40, 25);
    doc.fontSize(10).font('Helvetica')
       .text(`${company.email || ''} | ${company.phone || ''}`, 40, 55);
    doc.fillColor(accentColor).fontSize(36).font('Helvetica-Bold')
       .text('INVOICE', 400, 30, { align: 'right' });
    doc.fillColor('white').fontSize(12)
       .text(`#${items[0].invoice_no}`, 400, 70, { align: 'right' });

    let y = 120;
    doc.rect(40, y, 160, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9).font('Helvetica')
       .text('INVOICE DATE', 50, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(new Date(items[0].date).toLocaleDateString('en-IN', {
         day: '2-digit', month: 'short', year: 'numeric'
       }), 50, y+28);

    doc.rect(220, y, 335, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9).text('BILLED TO', 230, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(items[0].customer_name || 'Customer', 230, y+28);
    if (items[0].customer_address) {
      doc.fillColor(textLight).fontSize(9)
         .text(items[0].customer_address.substring(0, 45), 230, y+45);
    }

    y += 80;
    doc.rect(40, y, 515, 35).fill(primaryColor);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text('ITEM', 50, y+12)
       .text('QTY (KG)', 300, y+12, { align: 'center' })
       .text('RATE/KG', 380, y+12, { align: 'center' })
       .text('AMOUNT', 480, y+12, { align: 'right' });

    y += 35;
    items.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? 'white' : lightBg;
      doc.rect(40, y, 515, 45).fill(bgColor).stroke(borderColor);
      const displayName = item.variant_name ? `${item.item_name} - ${item.variant_name}` : item.item_name;
      doc.fillColor(textDark).fontSize(11).font('Helvetica')
         .text(displayName.substring(0, 35), 50, y+10)
         .text(item.quantity.toFixed(2), 300, y+10, { align: 'center' })
         .text(`₹${item.price_per_kg.toFixed(2)}`, 380, y+10, { align: 'center' })
         .text(`₹${item.total.toFixed(2)}`, 485, y+10, { align: 'right' });
      y += 45;
    });

    y += 20;
    doc.rect(300, y, 255, 80).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(10).font('Helvetica')
       .text('Subtotal', 315, y+15)
       .text(`₹${grandTotal.toFixed(2)}`, 480, y+15, { align: 'right' });
    
    y += 40;
    doc.rect(300, y, 255, 50).fill(primaryColor);
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
       .text('GRAND TOTAL', 315, y+18);
    doc.fontSize(18).text(`₹${grandTotal.toFixed(2)}`, 380, y+16, { align: 'right' });

    y += 80;
    doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold').text('Payment Terms', 40, y);
    doc.fillColor(textLight).fontSize(10).font('Helvetica')
       .text('Payment due within 30 days of invoice date.', 40, y+18);

    y += 50;
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