const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const verifyToken = require('../middleware/auth');
const { requireWriteAccess } = require('../middleware/subscriptionAuth');
const { purchaseValidation, commonValidations } = require('../config/validation');
const PurchaseService = require('../services/purchaseService');
const { wsManager } = require('../config/websocket');
const ApiResponse = require('../utils/response');

router.post('/', verifyToken, requireWriteAccess(), purchaseValidation.create, async (req, res) => {
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

router.delete('/:id', verifyToken, requireWriteAccess(), commonValidations.idValidation, async (req, res) => {
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

router.put('/:id/payment', verifyToken, requireWriteAccess(), commonValidations.idValidation, async (req, res) => {
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

const PURCHASE_INVOICE = {
  width: 420,
  height: 842,
  left: 24,
  footerTop: 744,
  firstTableTop: 228,
  continuedTableTop: 96,
  rowHeight: 33,
  finalSectionHeight: 184,
  colors: {
    teal: '#123A3A',
    orange: '#D48145',
    amber: '#A85D3D',
    cream: '#F8F3EA',
    paper: '#FFFEFA',
    border: '#D8D2C7',
    dark: '#1E2D2D',
    mid: '#536262',
    light: '#7A8988'
  }
};
PURCHASE_INVOICE.contentWidth = PURCHASE_INVOICE.width - PURCHASE_INVOICE.left * 2;

function cleanInvoiceText(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function formatPurchaseDate(value) {
  const text = cleanInvoiceText(value);
  if (!text) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPurchaseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Invalid purchase invoice amount');
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fitPurchaseText(doc, value, font, sizes, maxWidth, characterSpacing = 0) {
  const text = cleanInvoiceText(value);
  for (const size of sizes) {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(text) + Math.max(0, text.length - 1) * characterSpacing <= maxWidth) {
      return { text, size };
    }
  }

  const size = sizes[sizes.length - 1];
  doc.font(font).fontSize(size);
  let shortened = text;
  while (
    shortened.length > 0
    && doc.widthOfString(`${shortened}...`)
      + Math.max(0, shortened.length + 2) * characterSpacing > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }
  return { text: shortened ? `${shortened}...` : '...', size };
}

function drawPurchasePageFrame(doc, companyName, purchaseNo) {
  const { width, height, colors } = PURCHASE_INVOICE;
  doc.save();
  doc.rect(0, 0, width, height).fill(colors.paper);
  doc.save();
  doc.fillColor(colors.teal).fillOpacity(0.045).font('Helvetica-Bold').fontSize(15);
  doc.rotate(-35, { origin: [width / 2, height / 2] });
  const watermark = `${companyName}  STOCK IN  ${purchaseNo}`;
  for (let y = 75; y <= 700; y += 125) {
    doc.text(watermark, -115, y, { width: 650, lineBreak: false });
    doc.text(watermark, 200, y + 55, { width: 650, lineBreak: false });
  }
  doc.restore();
  doc.rect(10, 10, width - 20, height - 20).lineWidth(1.1).strokeColor(colors.teal).stroke();
  doc.rect(13, 13, width - 26, height - 26).lineWidth(0.55).strokeColor(colors.amber).stroke();
  doc.restore();
}

function drawPurchaseHeader(doc, vendor, company, purchaseNo, purchaseDate) {
  const { width, left, contentWidth, colors } = PURCHASE_INVOICE;
  const companyName = cleanInvoiceText(company.name) || 'Company';
  const companyHeading = fitPurchaseText(
    doc,
    companyName.toUpperCase(),
    'Helvetica-Bold',
    [24, 22, 20, 18, 16, 15],
    contentWidth - 36,
    1
  );
  doc.rect(14.5, 14.5, width - 29, 85).fill(colors.teal);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(companyHeading.size)
    .text(companyHeading.text, left + 18, 21, {
      width: contentWidth - 36,
      characterSpacing: 1,
      lineBreak: false
    });
  const contact = [company.email, company.phone].map(cleanInvoiceText).filter(Boolean).join('  |  ');
  if (contact) {
    doc.fillColor('#E1EAE7').font('Helvetica').fontSize(8.5)
      .text(contact, left + 18, 51, { width: contentWidth - 36, lineBreak: false });
  }
  if (company.address) {
    doc.fillColor('#CFDCD8').font('Helvetica').fontSize(8)
      .text(cleanInvoiceText(company.address), left + 18, 65, {
        width: contentWidth - 36,
        lineBreak: false
      });
  }
  doc.moveTo(14.5, 99).lineTo(width - 14.5, 99).lineWidth(1.2).strokeColor(colors.amber).stroke();

  doc.rect(left, 112, contentWidth, 62).fill(colors.cream);
  doc.rect(left, 112, 3, 62).fill(colors.orange);
  doc.fillColor(colors.amber).font('Helvetica-Bold').fontSize(7)
    .text('PURCHASED FROM', left + 13, 120, { characterSpacing: 0.9 });
  const vendorHeading = fitPurchaseText(
    doc,
    vendor.name || 'Supplier',
    'Helvetica-Bold',
    [13, 12, 11, 10],
    contentWidth - 26
  );
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(vendorHeading.size)
    .text(vendorHeading.text, left + 13, 132, { width: contentWidth - 26, lineBreak: false });
  const vendorDetails = [vendor.address, vendor.phone && `Ph: ${vendor.phone}`]
    .map(cleanInvoiceText).filter(Boolean).join('  |  ');
  if (vendorDetails) {
    doc.fillColor(colors.mid).font('Helvetica').fontSize(8.5)
      .text(vendorDetails, left + 13, 151, { width: contentWidth - 26, lineBreak: false });
  }

  doc.fillColor(colors.amber).font('Helvetica-Bold').fontSize(7)
    .text('PURCHASE INVOICE', left, 184, {
      width: contentWidth,
      characterSpacing: 0.9,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica-Bold').fontSize(7)
    .text('PURCHASE NO.', left, 197, { width: 205, characterSpacing: 0.55, lineBreak: false });
  doc.fillColor(colors.mid).font('Helvetica-Bold').fontSize(7)
    .text('PURCHASE DATE', left + 220, 197, {
      width: contentWidth - 220,
      align: 'right',
      characterSpacing: 0.55,
      lineBreak: false
    });
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(11)
    .text(purchaseNo, left, 208, { width: 205, lineBreak: false });
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(9)
    .text(formatPurchaseDate(purchaseDate), left + 220, 208, {
      width: contentWidth - 220,
      align: 'right',
      lineBreak: false
    });
}

function drawPurchaseTableHeader(doc, y) {
  const { left, contentWidth, colors } = PURCHASE_INVOICE;
  doc.rect(left, y, contentWidth, 25).fillAndStroke(colors.teal, colors.teal);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
    .text('ITEM / DESCRIPTION', left + 9, y + 8, {
      width: contentWidth - 115,
      characterSpacing: 0.45,
      lineBreak: false
    });
  doc.text('PURCHASE COST (Rs.)', left + contentWidth - 103, y + 8, {
    width: 94,
    align: 'right',
    characterSpacing: 0.25,
    lineBreak: false
  });
}

function drawPurchaseItem(doc, item, index, y) {
  const { left, contentWidth, rowHeight, colors } = PURCHASE_INVOICE;
  if (index % 2 === 1) doc.rect(left, y, contentWidth, rowHeight).fill(colors.cream);
  doc.moveTo(left, y + rowHeight).lineTo(left + contentWidth, y + rowHeight)
    .lineWidth(0.35).strokeColor(colors.border).stroke();
  const itemName = cleanInvoiceText(item.item_name) || 'Item';
  const variant = cleanInvoiceText(item.variant_name);
  const displayName = variant ? `${itemName} - ${variant}` : itemName;
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(8.5)
    .text(displayName, left + 8, y + 5, {
      width: contentWidth - 126,
      lineBreak: false,
      ellipsis: true
    });
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(8)
    .text(`Rs. ${formatPurchaseAmount(item.total)}`, left + contentWidth - 112, y + 11, {
      width: 103,
      align: 'right',
      lineBreak: false
    });
  const details = `${Number(item.quantity).toFixed(3)} kg × Rs. ${formatPurchaseAmount(item.price_per_kg)} / kg • Purchase from supplier`;
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.2)
    .text(details, left + 8, y + 19, {
      width: contentWidth - 16,
      lineBreak: false
    });
}

function drawPurchaseTotals(doc, y, grandTotal) {
  const { left, contentWidth, colors } = PURCHASE_INVOICE;
  const amount = `Rs. ${formatPurchaseAmount(grandTotal)}`;
  doc.moveTo(left, y).lineTo(left + contentWidth, y).lineWidth(0.6).strokeColor(colors.border).stroke();
  doc.fillColor(colors.mid).font('Helvetica').fontSize(8)
    .text('Subtotal', left + 10, y + 7, { width: 150, lineBreak: false });
  doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
    .text(amount, left + 170, y + 7, { width: contentWidth - 180, align: 'right', lineBreak: false });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(8)
    .text('Taxes & Fees', left + 10, y + 21, { width: 150, lineBreak: false });
  doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
    .text('Rs. 0.00', left + 170, y + 21, { width: contentWidth - 180, align: 'right', lineBreak: false });
  doc.fillColor(colors.light).font('Helvetica').fontSize(7)
    .text('(Inclusive)', left + 10, y + 34, { width: 150, lineBreak: false });
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(8.5)
    .text('PURCHASE TOTAL', left + 170, y + 35, { width: 82, characterSpacing: 0.15, lineBreak: false });
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(10)
    .text(amount, left + 255, y + 34, { width: contentWidth - 265, align: 'right', lineBreak: false });
  doc.moveTo(left, y + 51).lineTo(left + contentWidth, y + 51)
    .lineWidth(0.6).strokeColor(colors.border).stroke();

  y += 59;
  doc.rect(left, y, contentWidth, 50).fill(colors.cream);
  doc.rect(left, y, 2.5, 50).fill(colors.orange);
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(7.5)
    .text('PURCHASE TOTAL IN WORDS', left + 10, y + 7, {
      width: contentWidth - 20,
      characterSpacing: 0.55,
      lineBreak: false
    });
  doc.fillColor(colors.dark).font('Helvetica-Oblique').fontSize(7.5)
    .text(`Indian Rupees ${amount} Only`, left + 10, y + 20, {
      width: contentWidth - 20,
      height: 25,
      lineGap: 1
    });

  y += 58;
  doc.moveTo(left, y).lineTo(left + contentWidth, y).lineWidth(0.5).strokeColor(colors.border).stroke();
  doc.fillColor(colors.amber).font('Helvetica-Bold').fontSize(7.5)
    .text('PURCHASE & RECEIPT NOTES', left + 10, y + 7, {
      width: contentWidth - 20,
      characterSpacing: 0.65,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.5)
    .text('Please verify received goods and quantities with the supplier.', left + 10, y + 20, {
      width: contentWidth - 20,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.5)
    .text('Retain this purchase record for stock and payment reference.  E. & O.E.', left + 10, y + 34, {
      width: contentWidth - 20,
      lineBreak: false
    });
}

function drawPurchaseFooter(doc, pageNumber, pageCount, purchaseNo, companyName) {
  const { width, left, contentWidth, footerTop, colors } = PURCHASE_INVOICE;
  doc.fillColor(colors.teal).fillOpacity(0.48).font('Courier').fontSize(2.4)
    .text(`${purchaseNo}  `.repeat(8), left, footerTop, {
      width: contentWidth,
      lineBreak: false,
      characterSpacing: 0,
      height: 4
    });
  doc.fillOpacity(1);
  doc.moveTo(left, footerTop + 7).lineTo(width - left, footerTop + 7)
    .lineWidth(0.5).strokeColor(colors.orange).stroke();
  doc.fillColor(colors.teal).font('Courier-Bold').fontSize(10)
    .text(purchaseNo, left, footerTop + 14, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7)
    .text('Purchase reference for the supplier, total and goods received.', left, footerTop + 31, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7)
    .text('Keep this document with your stock and payment records.', left, footerTop + 41, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
  doc.fillColor(colors.amber).font('Helvetica-Bold').fontSize(7)
    .text('PURCHASE RECORD  •  STOCK RECEIVED', left, footerTop + 51, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
  doc.fillColor(colors.light).font('Helvetica').fontSize(7)
    .text(`${companyName}  |  ${purchaseNo}  |  Page ${pageNumber} of ${pageCount}`, left, footerTop + 63, {
      width: contentWidth,
      align: 'center',
      lineBreak: false
    });
}

function renderPurchaseInvoice(res, items, company, vendor, grandTotal, purchaseDate, purchaseNo) {
  const { width, height, left, contentWidth, footerTop, firstTableTop, continuedTableTop, rowHeight, finalSectionHeight, colors } = PURCHASE_INVOICE;
  const companyName = cleanInvoiceText(company.name) || 'Company';
  const doc = new PDFDocument({
    size: [width, height],
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    bufferPages: true,
    info: { Title: `Purchase Invoice ${purchaseNo}`, Author: companyName }
  });
  doc.pipe(res);

  const firstFinalCapacity = Math.floor((footerTop - firstTableTop - 25 - finalSectionHeight) / rowHeight);
  const firstOpenCapacity = Math.floor((footerTop - firstTableTop - 25) / rowHeight);
  const continuedFinalCapacity = Math.floor((footerTop - continuedTableTop - 25 - finalSectionHeight) / rowHeight);
  const continuedOpenCapacity = Math.floor((footerTop - continuedTableTop - 25) / rowHeight);
  let pageCount = 0;
  let itemIndex = 0;

  while (itemIndex < items.length) {
    const isFirstPage = pageCount === 0;
    const tableTop = isFirstPage ? firstTableTop : continuedTableTop;
    let take;
    if (isFirstPage) {
      if (items.length <= firstFinalCapacity) take = items.length;
      else if (items.length <= firstFinalCapacity + continuedFinalCapacity) take = firstFinalCapacity;
      else if (items.length <= firstOpenCapacity + continuedFinalCapacity) take = items.length - continuedFinalCapacity;
      else take = Math.min(firstOpenCapacity, Math.max(firstFinalCapacity, items.length - continuedFinalCapacity - continuedOpenCapacity));
    } else if (items.length - itemIndex <= continuedFinalCapacity) {
      take = items.length - itemIndex;
    } else {
      take = Math.min(continuedOpenCapacity, items.length - itemIndex - continuedFinalCapacity);
      take = Math.max(1, take);
    }

    if (!isFirstPage) doc.addPage({ size: [width, height], margin: 0 });
    drawPurchasePageFrame(doc, companyName, purchaseNo);
    if (isFirstPage) {
      drawPurchaseHeader(doc, vendor, company, purchaseNo, purchaseDate);
    } else {
      const companyHeading = fitPurchaseText(doc, companyName, 'Helvetica-Bold', [14, 12, 10], contentWidth, 0.2);
      doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(companyHeading.size)
        .text(companyHeading.text, left, 28, {
          width: contentWidth,
          characterSpacing: 0.2,
          lineBreak: false
        });
      doc.fillColor(colors.amber).font('Helvetica-Bold').fontSize(8)
        .text('PURCHASE INVOICE (CONTINUED)', left, 53, {
          width: 195,
          characterSpacing: 0.65,
          lineBreak: false
        });
      doc.fillColor(colors.mid).font('Helvetica').fontSize(7)
        .text(`Purchase ${purchaseNo}`, left + 200, 53, {
          width: contentWidth - 200,
          align: 'right',
          lineBreak: false
        });
    }
    drawPurchaseTableHeader(doc, tableTop);
    let y = tableTop + 25;
    for (let offset = 0; offset < take; offset += 1) {
      drawPurchaseItem(doc, items[itemIndex], itemIndex, y);
      y += rowHeight;
      itemIndex += 1;
    }

    if (itemIndex === items.length) {
      if (y > footerTop - finalSectionHeight) {
        throw new Error('Purchase invoice items exceed the available page layout');
      }
      drawPurchaseTotals(doc, y + 5, grandTotal);
    }
    pageCount += 1;
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    drawPurchaseFooter(doc, index + 1, range.count, purchaseNo, companyName);
  }
  doc.end();
}

router.get('/invoice/:id', verifyToken, async (req, res) => {
  try {
    const { items, company, vendor, grandTotal, purchaseDate } = await PurchaseService.getInvoiceData(
      req.params.id,
      req.user.company_id
    );
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, 'Purchase invoice not found', 404);
    }

    const purchaseNo = `PR-${String(req.params.id).padStart(6, '0')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PurchaseInvoice-${purchaseNo}.pdf"`);
    renderPurchaseInvoice(res, items, company || {}, vendor || {}, grandTotal, purchaseDate, purchaseNo);
  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) ApiResponse.error(res, error.message);
  }
});

module.exports = router;
