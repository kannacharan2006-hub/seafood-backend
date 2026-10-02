const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/subscriptionAuth');
const { exportValidation, commonValidations } = require('../config/validation');
const ExportService = require('../services/exportService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

router.post('/', verifyToken, requireWriteAccess(), exportValidation.create, async (req, res) => {
  if (!['OWNER', 'EMPLOYEE'].includes(req.user.role)) {
    return ApiResponse.forbidden(res, 'Access denied');
  }
  try {
    const { customer_id, date, items } = req.body;
    const result = await ExportService.createExport(
      req.user.id,
      req.user.company_id,
      customer_id,
      date,
      items
    );
    
    wsManager.notifyExport(req.user.company_id, result);
    wsManager.notifyDashboardRefresh(req.user.company_id, { type: 'export_added' });
    
    ApiResponse.success(res, result, 'Export created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.delete('/:id', verifyToken, requireWriteAccess(), commonValidations.idValidation, async (req, res) => {
  try {
    const result = await ExportService.deleteExport(
      req.params.id,
      req.user.company_id
    );
    ApiResponse.success(res, result, 'Export deleted');
  } catch (error) {
    ApiResponse.error(res, error.message, 400);
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await ExportService.getExports(req.user.company_id, page, limit);
    ApiResponse.success(res, result);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/invoice/:id', verifyToken, commonValidations.idValidation, async (req, res) => {
  try {
    const { items, company, grandTotal } = await ExportService.getInvoiceData(
      req.params.id,
      req.user.company_id
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SalesInvoice-${items[0].invoice_no}.pdf"`);
    
    const doc = new PDFDocument({ size: 'A4', margin: 18 });
    doc.pipe(res);

    const navy = '#0f2040';
    const navyLight = '#1e3a5f';
    const emerald = '#065f46';
    const emeraldLight = '#10b981';
    const gold = '#c9a86a';
    const goldDark = '#8b7355';
    const cream = '#f0fdf4';
    const cream2 = '#fdfbf7';
    const border = '#a7d4b8';
    const borderLight = '#d1e8d9';
    const borderGold = '#d4c5a9';
    const textDark = '#1a2332';
    const textMid = '#4a5568';
    const textLight = '#718096';
    const pageW = 595.28, pageH = 841.89;

    doc.save();
    doc.rect(12, 12, pageW-24, pageH-24).lineWidth(1.2).strokeColor(navy).stroke();
    doc.rect(14.5, 14.5, pageW-29, pageH-29).lineWidth(0.4).strokeColor(gold).stroke();
    doc.restore();

    doc.rect(0, 0, pageW, 108).fill(navy);
    doc.rect(0, 105, pageW, 3).fill(emeraldLight);
    doc.rect(0, 95, pageW, 0.5).fillOpacity(0.3).fill('white').fillOpacity(1);

    const logoSize = 38;
    doc.save();
    doc.roundedRect(32, 18, logoSize, logoSize, 4).fill('#ffffff15').strokeColor(gold).lineWidth(0.8).stroke();
    doc.fillColor(gold).fontSize(18).font('Helvetica-Bold').text('◈', 32, 29, { width: logoSize, align: 'center' });
    doc.restore();
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text((company.name || 'SEAFOOD PRO').toUpperCase(), 78, 22, { characterSpacing: 1.2 });
    doc.fillColor(gold).fontSize(6.5).font('Helvetica').text('PREMIUM  SEAFOOD  TRADING  COMPANY', 78, 46, { characterSpacing: 2.5 });
    doc.fillColor('#a0aec0').fontSize(7).font('Helvetica').text(`${company.email || 'info@seafoodpro.com'}  •  ${company.phone || '+91 98765 43210'}`, 78, 58);
    if (company.address) doc.fillColor('#a0aec0').fontSize(6.5).text(company.address.substring(0,55), 78, 69, { width: 230 });

    doc.save();
    doc.roundedRect(380, 16, 175, 76, 6).fill('white').strokeColor(gold).lineWidth(0.7).stroke();
    doc.roundedRect(380, 16, 175, 22, 6).fill(emerald).stroke();
    doc.rect(380, 27, 175, 11).fill(emerald);
    doc.fillColor(gold).fontSize(7).font('Helvetica-Bold').text('S A L E S   I N V O I C E', 380, 23, { align: 'center', characterSpacing: 1.5 });
    doc.fillColor(navy).fontSize(7).font('Helvetica').text('Invoice No.', 392, 46);
    doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold').text(`${items[0].invoice_no}`, 392, 57);
    doc.moveTo(392, 72).lineTo(543, 72).lineWidth(0.4).strokeColor(borderLight).stroke();
    const invDate = new Date(items[0].date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.fillColor(textMid).fontSize(6.5).font('Helvetica').text('DATE', 392, 76);
    doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold').text(invDate.toUpperCase(), 470, 76, { align: 'right' });
    doc.restore();

    let y = 122;
    const drawInfoCard = (x, w, label, value, sub) => {
      doc.save();
      doc.roundedRect(x, y, w, 62, 5).fill('white').strokeColor(border).lineWidth(0.6).stroke();
      doc.roundedRect(x, y, w, 18, 5).fill(cream).stroke();
      doc.rect(x, y+9, w, 9).fill(cream);
      doc.moveTo(x+8, y+18).lineTo(x+w-8, y+18).lineWidth(0.4).strokeColor(borderLight).stroke();
      doc.fillColor(emerald).fontSize(6).font('Helvetica-Bold').text(label, x+10, y+7, { characterSpacing: 1.2 });
      doc.fillColor(textDark).fontSize(10).font('Helvetica-Bold').text(value, x+10, y+26, { width: w-20 });
      if (sub) doc.fillColor(textLight).fontSize(7).font('Helvetica').text(sub, x+10, y+42, { width: w-20 });
      doc.restore();
    };
    drawInfoCard(32, 165, 'B I L L E D   T O', items[0].customer_name || 'Customer', (items[0].customer_address||'').substring(0,42) || '—');
    drawInfoCard(207, 165, 'B I L L E D   B Y', company.name || 'Company', `${(company.email||'').substring(0,28)}  ${company.phone||''}`);
    doc.save();
    doc.roundedRect(382, y, 175, 62, 5).fill(navy).strokeColor(navy).lineWidth(0.6).stroke();
    doc.fillColor(gold).fontSize(6).font('Helvetica-Bold').text('P A Y M E N T   S U M M A R Y', 392, y+8, { characterSpacing: 0.8 });
    doc.fillColor('white').fontSize(7).font('Helvetica').text('Grand Total Receivable', 392, y+24);
    doc.fillColor(gold).fontSize(16).font('Helvetica-Bold').text(`Rs. ${(grandTotal||0).toLocaleString('en-IN', {minimumFractionDigits:2})}`, 392, y+34, { width: 155 });
    doc.restore();
    y += 76;
    doc.fillColor(textLight).fontSize(5.5).font('Helvetica').text('ORIGINAL COPY  •  FOR RECIPIENT', 32, y, { characterSpacing: 1 });
    doc.fillColor(border).fontSize(5.5).text('— — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —', 320, y);
    y += 10;

    const tableX = 32, tableW = 531, colQty = 78, colRate = 95, colAmt = 110;
    const colItem = tableW - colQty - colRate - colAmt;
    doc.save();
    doc.roundedRect(tableX, y, tableW, 24, 4).fill(navy).stroke();
    doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold');
    doc.text('#', tableX+8, y+8, { width: 18, align: 'center' });
    doc.text('ITEM  DESCRIPTION', tableX+30, y+9, { characterSpacing: 0.8 });
    doc.text('QTY (KG)', tableX+colItem+30, y+9, { width: colQty-10, align: 'center' });
    doc.text('RATE / KG', tableX+colItem+colQty+30, y+9, { width: colRate-10, align: 'center' });
    doc.text('AMOUNT (Rs.)', tableX+tableW-colAmt+5, y+9, { width: colAmt-12, align: 'right' });
    doc.restore();
    y += 26;
    const rowH = 26;
    items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? 'white' : cream;
      const isLast = idx === items.length - 1;
      doc.save();
      doc.rect(tableX, y, tableW, rowH).fill(bg).strokeColor(borderLight).lineWidth(0.4).stroke();
      if (!isLast) doc.moveTo(tableX, y+rowH).lineTo(tableX+tableW, y+rowH).lineWidth(0.3).strokeColor(borderLight).stroke();
      doc.moveTo(tableX+26, y).lineTo(tableX+26, y+rowH).lineWidth(0.3).strokeColor(borderLight).stroke();
      doc.moveTo(tableX+colItem+26, y).lineTo(tableX+colItem+26, y+rowH).lineWidth(0.3).strokeColor(borderLight).stroke();
      doc.moveTo(tableX+colItem+colQty+26, y).lineTo(tableX+colItem+colQty+26, y+rowH).lineWidth(0.3).strokeColor(borderLight).stroke();
      doc.moveTo(tableX+tableW-colAmt, y).lineTo(tableX+tableW-colAmt, y+rowH).lineWidth(0.3).strokeColor(borderLight).stroke();
      const displayName = item.variant_name ? `${item.item_name} — ${item.variant_name}` : item.item_name;
      doc.fillColor(navy).fontSize(6).font('Helvetica-Bold').text(String(idx+1).padStart(2,'0'), tableX+2, y+10, { width: 22, align: 'center' });
      doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold').text(displayName.substring(0,42), tableX+30, y+6, { width: colItem-8 });
      doc.fillColor(textLight).fontSize(6).font('Helvetica').text('HSN: 0306  •  Fresh', tableX+30, y+16);
      doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(Number(item.quantity).toFixed(2), tableX+colItem+30, y+9, { width: colQty-10, align: 'center' });
      doc.fillColor(textMid).fontSize(7.5).font('Helvetica').text(`Rs. ${Number(item.price_per_kg).toFixed(2)}`, tableX+colItem+colQty+30, y+9, { width: colRate-10, align: 'center' });
      doc.fillColor(navy).fontSize(7.5).font('Helvetica-Bold').text(`Rs. ${Number(item.total).toLocaleString('en-IN',{minimumFractionDigits:2})}`, tableX+tableW-colAmt+5, y+9, { width: colAmt-12, align: 'right' });
      doc.restore();
      y += rowH;
    });
    doc.save(); doc.roundedRect(tableX, y, tableW, 0.8, 0).fill(gold); doc.restore();
    y += 6;
    const summaryX = 345, summaryW = 218;
    const amtStr = `Rs. ${(grandTotal||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
    doc.save();
    doc.roundedRect(summaryX, y, summaryW, 52, 5).fill('white').strokeColor(border).lineWidth(0.6).stroke();
    doc.moveTo(summaryX+10, y+26).lineTo(summaryX+summaryW-10, y+26).lineWidth(0.4).strokeColor(borderLight).stroke();
    doc.fillColor(textMid).fontSize(7).font('Helvetica').text('Subtotal', summaryX+14, y+10);
    doc.fillColor(textDark).fontSize(7).font('Helvetica').text(amtStr, summaryX+14, y+10, { width: summaryW-28, align: 'right' });
    doc.fillColor(textMid).fontSize(6.5).font('Helvetica').text('Taxes & Fees', summaryX+14, y+16);
    doc.fillColor(textDark).fontSize(6.5).font('Helvetica').text('Rs. 0.00', summaryX+14, y+16, { width: summaryW-28, align: 'right' });
    doc.fillColor(textLight).fontSize(5.5).font('Helvetica').text('(Inclusive of all charges)', summaryX+14, y+32);
    doc.fillColor(navy).fontSize(8).font('Helvetica-Bold').text('GRAND TOTAL', summaryX+14, y+38);
    doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text(amtStr, summaryX+14, y+36, { width: summaryW-28, align: 'right' });
    doc.restore();
    doc.save();
    doc.roundedRect(tableX, y, 298, 52, 5).fill(cream2).strokeColor(borderGold).lineWidth(0.5).stroke();
    doc.fillColor(navy).fontSize(7).font('Helvetica-Bold').text('Amount in Words', tableX+12, y+8, { characterSpacing: 0.5 });
    doc.fillColor(textMid).fontSize(7).font('Helvetica-Oblique').text(`Indian Rupees ${amtStr} Only`, tableX+12, y+20, { width: 274 });
    doc.moveTo(tableX+12, y+38).lineTo(tableX+286, y+38).lineWidth(0.3).strokeColor(borderGold).stroke();
    doc.fillColor(textLight).fontSize(5.5).font('Helvetica').text('Payment due within 30 days of invoice date  •  E. & O.E.', tableX+12, y+42);
    doc.restore();
    y += 64;
    doc.save();
    doc.roundedRect(tableX, y, 298, 48, 5).fill('white').strokeColor(borderLight).lineWidth(0.5).stroke();
    doc.fillColor(goldDark).fontSize(6).font('Helvetica-Bold').text('T E R M S   &   P A Y M E N T', tableX+12, y+8, { characterSpacing: 0.8 });
    doc.fillColor(textMid).fontSize(6.5).font('Helvetica').text('1. Payment due within 30 days.  2. Interest @18% p.a. after due date.', tableX+12, y+20);
    doc.fillColor(textMid).fontSize(6.5).font('Helvetica').text('3. Goods once sold will not be taken back.', tableX+12, y+30);
    doc.restore();
    doc.save();
    doc.roundedRect(summaryX, y, summaryW, 48, 5).fill('white').strokeColor(borderLight).lineWidth(0.5).stroke();
    doc.fillColor(textLight).fontSize(6).font('Helvetica').text('For ' + (company.name || 'SEAFOOD PRO'), summaryX+14, y+8, { align: 'right', width: summaryW-28 });
    doc.moveTo(summaryX+60, y+38).lineTo(summaryX+summaryW-20, y+38).lineWidth(0.6).strokeColor(navy).stroke();
    doc.fillColor(navy).fontSize(6).font('Helvetica-Bold').text('Authorized Signatory', summaryX+14, y+40, { width: summaryW-28, align: 'center' });
    doc.restore();
    y += 62;
    doc.save();
    doc.moveTo(32, y).lineTo(pageW-32, y).lineWidth(0.4).strokeColor(border).stroke();
    doc.moveTo(240, y+1).lineTo(355, y+1).lineWidth(0.8).strokeColor(gold).stroke();
    doc.fillColor(navy).fontSize(6).font('Helvetica-Bold').text('THANK YOU FOR YOUR BUSINESS', 32, y+7, { align: 'center', characterSpacing: 2 });
    doc.fillColor(textLight).fontSize(6).font('Helvetica').text(`${company.name || 'Company'}  •  This is a computer generated invoice  •  All Rights Reserved`, 32, y+17, { align: 'center' });
    doc.fillColor(border).fontSize(5).font('Helvetica').text(`Invoice ${items[0].invoice_no}  •  Page 1 of 1  •  Generated on ${new Date().toLocaleDateString('en-IN')}  •  www.seafoodpro.com`, 32, y+26, { align: 'center' });
    doc.restore();

    doc.end();
  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) ApiResponse.error(res, error.message);
  }
});

module.exports = router;
