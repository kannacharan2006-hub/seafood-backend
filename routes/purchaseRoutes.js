const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');
const { purchaseValidation, commonValidations } = require('../config/validation');
const PurchaseService = require('../services/purchaseService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

router.post('/', verifyToken, purchaseValidation.create, async (req, res) => {
  try {
    if (!['OWNER', 'EMPLOYEE'].includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Access denied');
    }

    const { vendor_id, supplier_type, date, items, payment_mode, payment_phone } = req.body;
    const result = await PurchaseService.createPurchase(
      req.user.id, req.user.company_id, vendor_id, supplier_type, date, items, payment_mode, payment_phone
    );
    
    wsManager.notifyPurchase(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'purchase_added' });
    
    ApiResponse.success(res, result, 'Purchase created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.delete('/:id', verifyToken, commonValidations.idValidation, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return ApiResponse.forbidden(res, 'Only Owner can delete purchase');
    }

    const result = await PurchaseService.deletePurchase(req.params.id, req.user.company_id);
    ApiResponse.success(res, result, 'Purchase deleted');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.put('/:id/payment', verifyToken, commonValidations.idValidation, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return ApiResponse.forbidden(res, 'Only Owner can update payment');
    }

    const { payment_status, payment_mode, payment_phone, payment_reference, payment_notes } = req.body;
    const result = await PurchaseService.updatePayment(
      req.params.id, req.user.company_id, 
      payment_status, payment_mode, payment_phone, payment_reference, payment_notes
    );
    
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'payment_updated' });
    
    ApiResponse.success(res, result, 'Payment updated');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.get('/invoice/:id', verifyToken, async (req, res) => {
  try {
    const { items, company, vendor, grandTotal, purchaseDate } = await PurchaseService.getInvoiceData(
      req.params.id,
      req.user.company_id
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Purchase-${req.params.id}.pdf"`);
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const primaryColor = '#1e3a5f';
    const accentColor = '#dc2626';
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
       .text('PURCHASE', 400, 30, { align: 'right' });
    doc.fillColor('white').fontSize(12)
       .text(`#PR-${req.params.id.toString().padStart(6, '0')}`, 400, 70, { align: 'right' });

    let y = 120;
    doc.rect(40, y, 160, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9).font('Helvetica')
       .text('PURCHASE DATE', 50, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(new Date(purchaseDate).toLocaleDateString('en-IN', {
         day: '2-digit', month: 'short', year: 'numeric'
       }), 50, y+28);

    doc.rect(220, y, 335, 60).fill(lightBg).stroke(borderColor);
    doc.fillColor(textLight).fontSize(9).text('SUPPLIER', 230, y+10);
    doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold')
       .text(vendor.name || 'Vendor', 230, y+28);
    if (vendor.address) {
      doc.fillColor(textLight).fontSize(9)
         .text(vendor.address.substring(0, 45), 230, y+45);
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
    doc.rect(300, y, 255, 50).fill(accentColor);
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
       .text('GRAND TOTAL', 315, y+18);
    doc.fontSize(18).text(`₹${grandTotal.toFixed(2)}`, 380, y+16, { align: 'right' });

    y += 80;
    doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold').text('Terms & Conditions', 40, y);
    doc.fillColor(textLight).fontSize(10).font('Helvetica')
       .text('Payment due as per agreement with supplier.', 40, y+18);

    y += 50;
    doc.moveTo(40, y).lineTo(555, y).lineWidth(1).stroke(borderColor);
    y += 15;
    doc.fillColor(textLight).fontSize(9)
       .text(`${company.name || 'Company'} | All Rights Reserved`, 40, y, { align: 'center' })
       .text('Thank you for your business!', 40, y + 12, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) ApiResponse.error(res, error.message);
  }
});

module.exports = router;
