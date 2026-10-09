const express = require('express');
const crypto = require('crypto');
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

const INVOICE_COLORS = {
  navy: '#102542',
  emerald: '#08785B',
  gold: '#C9A86A',
  cream: '#F8F6EF',
  paper: '#FFFEFA',
  border: '#C9D8CF',
  dark: '#182434',
  mid: '#4A5968',
  light: '#73808B'
};

const INVOICE_WIDTH = 420;
const INVOICE_HEIGHT = 842;
const CONTENT_LEFT = 24;
const CONTENT_WIDTH = INVOICE_WIDTH - CONTENT_LEFT * 2;
const FOOTER_TOP = 744;
const FIRST_TABLE_TOP = 228;
const CONTINUED_TABLE_TOP = 96;
const ITEM_ROW_HEIGHT = 33;
const FINAL_SECTION_HEIGHT = 184;

function cleanString(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function fixedNumber(value, decimals, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid numeric value for invoice ${fieldName}`);
  }
  return number.toFixed(decimals);
}

function createAuthenticityPayload(items, company, grandTotal) {
  const first = items[0];
  const normalizedItems = items.map(item => ({
    item_name: cleanString(item.item_name),
    variant_name: cleanString(item.variant_name),
    quantity: fixedNumber(item.quantity, 3, 'quantity'),
    price_per_kg: fixedNumber(item.price_per_kg, 2, 'price_per_kg'),
    total: fixedNumber(item.total, 2, 'total')
  }));

  // Sorting canonicalized line objects makes the signature stable if a query
  // returns the same invoice lines in a different order.
  normalizedItems.sort((left, right) => {
    const leftLine = JSON.stringify(left);
    const rightLine = JSON.stringify(right);
    return leftLine < rightLine ? -1 : leftLine > rightLine ? 1 : 0;
  });

  return {
    company_name: cleanString(company && company.name),
    customer_name: cleanString(first.customer_name),
    balance: fixedNumber(grandTotal, 2, 'balance'),
    items: normalizedItems,
    invoice_no: cleanString(first.invoice_no),
    date: cleanString(first.date)
  };
}

function createAuthenticityCode(items, company, grandTotal) {
  const secret = process.env.INVOICE_SIGNING_SECRET;
  if (!secret) {
    throw new Error('INVOICE_SIGNING_SECRET is required to generate or verify invoices');
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(createAuthenticityPayload(items, company, grandTotal)))
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();

  return digest.match(/.{4}/g).join('-');
}

function safeFilePart(value, fallback) {
  const sanitized = cleanString(value)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return sanitized || fallback;
}

function truncateToWidth(doc, value, font, size, maxWidth) {
  const text = cleanString(value);
  doc.font(font).fontSize(size);
  if (doc.widthOfString(text) <= maxWidth) return text;

  const ellipsis = '...';
  let shortened = text;
  while (shortened && doc.widthOfString(`${shortened}${ellipsis}`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return shortened ? `${shortened}${ellipsis}` : ellipsis;
}

function fitSingleLine(doc, value, font, sizes, maxWidth, characterSpacing = 0) {
  const text = cleanString(value);
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

function formatAmount(value) {
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const SMALL_NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS_WORDS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];
const INDIAN_SCALES = [
  '', 'Thousand', 'Lakh', 'Crore', 'Arab', 'Kharab', 'Neel', 'Padma', 'Shankh'
];

function belowOneThousand(number) {
  const words = [];
  if (number >= 100) {
    words.push(SMALL_NUMBER_WORDS[Math.floor(number / 100)], 'Hundred');
    number %= 100;
  }
  if (number >= 20) {
    words.push(TENS_WORDS[Math.floor(number / 10)]);
    number %= 10;
  }
  if (number > 0) words.push(SMALL_NUMBER_WORDS[number]);
  return words.filter(Boolean).join(' ');
}

function integerInIndianWords(value) {
  let number = BigInt(value);
  if (number === 0n) return 'Zero';

  const groups = [];
  groups.push(Number(number % 1000n));
  number /= 1000n;
  while (number > 0n) {
    groups.push(Number(number % 100n));
    number /= 100n;
  }

  const words = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    if (groups[index] === 0) continue;
    const scale = index === 0
      ? ''
      : (INDIAN_SCALES[index] || `10^${index * 2 + 1}`);
    words.push(belowOneThousand(groups[index]), scale);
  }
  return words.filter(Boolean).join(' ');
}

function amountInIndianWords(value) {
  const amountInPaise = BigInt(Math.round(Math.abs(Number(value)) * 100));
  const rupees = amountInPaise / 100n;
  const paise = Number(amountInPaise % 100n);
  const sign = Number(value) < 0 ? 'Minus ' : '';
  const paiseWords = paise ? ` and ${belowOneThousand(paise)} Paise` : '';
  return `Indian Rupees ${sign}${integerInIndianWords(rupees)}${paiseWords} Only`;
}

function formatInvoiceDate(value) {
  const dateText = cleanString(value);
  if (!dateText) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateText) ? `${dateText}T00:00:00` : dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function drawPageFrame(doc, companyName, invoiceNo) {
  const colors = INVOICE_COLORS;
  doc.save();
  doc.rect(0, 0, INVOICE_WIDTH, INVOICE_HEIGHT).fill(colors.paper);

  // Text-only watermark: rotated repeats are deliberately kept behind content.
  doc.save();
  doc.fillColor(colors.navy).fillOpacity(0.045).font('Helvetica-Bold').fontSize(15);
  doc.rotate(-35, { origin: [INVOICE_WIDTH / 2, INVOICE_HEIGHT / 2] });
  const watermark = `${companyName}  ${invoiceNo}`;
  for (let y = 75; y <= 700; y += 125) {
    doc.text(watermark, -115, y, { width: 650, lineBreak: false });
    doc.text(watermark, 200, y + 55, { width: 650, lineBreak: false });
  }
  doc.restore();

  doc.rect(10, 10, INVOICE_WIDTH - 20, INVOICE_HEIGHT - 20)
    .lineWidth(1.1).strokeColor(colors.navy).stroke();
  doc.rect(13, 13, INVOICE_WIDTH - 26, INVOICE_HEIGHT - 26)
    .lineWidth(0.45).strokeColor(colors.gold).stroke();
  doc.restore();
}

function drawFirstPageHeader(doc, items, company) {
  const colors = INVOICE_COLORS;
  const first = items[0];
  const companyName = cleanString(company.name) || 'Company';

  const companyHeading = fitSingleLine(
    doc,
    companyName.toUpperCase(),
    'Helvetica-Bold',
    [24, 22, 20, 18, 16, 15],
    CONTENT_WIDTH - 36,
    1
  );
  doc.rect(14.5, 14.5, INVOICE_WIDTH - 29, 85).fill(colors.navy);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(companyHeading.size)
    .text(companyHeading.text, CONTENT_LEFT + 18, 21, {
      width: CONTENT_WIDTH - 36,
      characterSpacing: 1,
      lineBreak: false
    });
  const companyDetails = [company.email, company.phone].map(cleanString).filter(Boolean).join('  |  ');
  if (companyDetails) {
    doc.fillColor('#E7EDF2').font('Helvetica').fontSize(8.5)
      .text(truncateToWidth(doc, companyDetails, 'Helvetica', 8.5, CONTENT_WIDTH - 36), CONTENT_LEFT + 18, 51, {
        width: CONTENT_WIDTH - 36,
        lineBreak: false
      });
  }
  if (company.address) {
    doc.fillColor('#D2DCE5').font('Helvetica').fontSize(8)
      .text(truncateToWidth(doc, company.address, 'Helvetica', 8, CONTENT_WIDTH - 36), CONTENT_LEFT + 18, 65, {
        width: CONTENT_WIDTH - 36,
        lineBreak: false
      });
  }

  doc.moveTo(14.5, 99).lineTo(INVOICE_WIDTH - 14.5, 99)
    .lineWidth(1.2).strokeColor(colors.gold).stroke();

  doc.rect(CONTENT_LEFT, 112, CONTENT_WIDTH, 62).fill(colors.cream);
  doc.rect(CONTENT_LEFT, 112, 3, 62).fill(colors.emerald);
  doc.fillColor(colors.emerald).font('Helvetica-Bold').fontSize(7)
    .text('BILLED TO', CONTENT_LEFT + 13, 120, {
      width: CONTENT_WIDTH - 26,
      characterSpacing: 0.9,
      lineBreak: false
    });
  const customerHeading = fitSingleLine(
    doc,
    first.customer_name || 'Customer',
    'Helvetica-Bold',
    [13, 12, 11, 10],
    CONTENT_WIDTH - 26
  );
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(customerHeading.size)
    .text(customerHeading.text, CONTENT_LEFT + 13, 132, {
      width: CONTENT_WIDTH - 26,
      lineBreak: false
    });
  if (first.customer_address) {
    doc.fillColor(colors.mid).font('Helvetica').fontSize(8.5)
      .text(truncateToWidth(doc, first.customer_address, 'Helvetica', 8.5, CONTENT_WIDTH - 26), CONTENT_LEFT + 13, 151, {
        width: CONTENT_WIDTH - 26,
        lineBreak: false
      });
  }

  doc.fillColor(colors.emerald).font('Helvetica-Bold').fontSize(7)
    .text('SALES INVOICE', CONTENT_LEFT, 184, {
      width: CONTENT_WIDTH,
      characterSpacing: 0.9,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica-Bold').fontSize(7)
    .text('INVOICE NO.', CONTENT_LEFT, 197, {
      width: 205,
      characterSpacing: 0.55,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica-Bold').fontSize(7)
    .text('DATE', CONTENT_LEFT + 220, 197, {
      width: CONTENT_WIDTH - 220,
      align: 'right',
      characterSpacing: 0.55,
      lineBreak: false
    });
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(11)
    .text(truncateToWidth(doc, first.invoice_no, 'Helvetica-Bold', 11, 205), CONTENT_LEFT, 208, {
      width: 205,
      lineBreak: false
    });
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(9)
    .text(truncateToWidth(doc, formatInvoiceDate(first.date), 'Helvetica-Bold', 9, CONTENT_WIDTH - 220), CONTENT_LEFT + 220, 208, {
      width: CONTENT_WIDTH - 220,
      align: 'right',
      lineBreak: false
    });
}

function drawContinuedHeader(doc, invoiceNo, companyName) {
  const colors = INVOICE_COLORS;
  const companyHeading = fitSingleLine(
    doc,
    companyName,
    'Helvetica-Bold',
    [14, 12, 10],
    CONTENT_WIDTH,
    0.2
  );
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(companyHeading.size)
    .text(companyHeading.text, CONTENT_LEFT, 28, {
      width: CONTENT_WIDTH,
      characterSpacing: 0.2,
      lineBreak: false
    });
  doc.fillColor(colors.emerald).font('Helvetica-Bold').fontSize(8)
    .text('SALES INVOICE (CONTINUED)', CONTENT_LEFT, 53, {
      width: 195,
      characterSpacing: 0.65,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.5)
    .text(`Invoice ${truncateToWidth(doc, invoiceNo, 'Helvetica', 7.5, 125)}`, CONTENT_LEFT + 200, 53, {
      width: CONTENT_WIDTH - 200,
      align: 'right',
      lineBreak: false
    });
}

function drawTableHeader(doc, y) {
  const colors = INVOICE_COLORS;
  doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, 25)
    .fillAndStroke(colors.navy, colors.navy);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
    .text('ITEM / DESCRIPTION', CONTENT_LEFT + 9, y + 8, {
      width: CONTENT_WIDTH - 115,
      characterSpacing: 0.45,
      lineBreak: false
    });
  doc.text('AMOUNT (Rs.)', CONTENT_LEFT + CONTENT_WIDTH - 103, y + 8, {
    width: 94,
    align: 'right',
    characterSpacing: 0.35,
    lineBreak: false
  });
}

function drawItemRow(doc, item, index, y) {
  const colors = INVOICE_COLORS;
  if (index % 2 === 1) {
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, ITEM_ROW_HEIGHT).fill(colors.cream);
  }
  doc.moveTo(CONTENT_LEFT, y + ITEM_ROW_HEIGHT).lineTo(CONTENT_LEFT + CONTENT_WIDTH, y + ITEM_ROW_HEIGHT)
    .lineWidth(0.35).strokeColor(colors.border).stroke();

  const itemName = cleanString(item.variant_name)
    ? `${cleanString(item.item_name)} - ${cleanString(item.variant_name)}`
    : cleanString(item.item_name);
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(8.5)
    .text(truncateToWidth(doc, itemName || 'Item', 'Helvetica-Bold', 8.5, CONTENT_WIDTH - 126), CONTENT_LEFT + 8, y + 5, {
      width: CONTENT_WIDTH - 126,
      lineBreak: false
    });
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(8)
    .text(`Rs. ${formatAmount(item.total)}`, CONTENT_LEFT + CONTENT_WIDTH - 112, y + 11, {
      width: 103,
      align: 'right',
      lineBreak: false
    });

  const details = `${fixedNumber(item.quantity, 3, 'quantity')} kg × Rs. ${fixedNumber(item.price_per_kg, 2, 'price_per_kg')} / kg • HSN 0306`;
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.2)
    .text(truncateToWidth(doc, details, 'Helvetica', 7.2, CONTENT_WIDTH - 16), CONTENT_LEFT + 8, y + 19, {
      width: CONTENT_WIDTH - 16,
      lineBreak: false
    });
}

function drawFinalSections(doc, y, grandTotal, authenticityCode) {
  const colors = INVOICE_COLORS;
  const amount = `Rs. ${formatAmount(grandTotal)}`;

  doc.moveTo(CONTENT_LEFT, y).lineTo(CONTENT_LEFT + CONTENT_WIDTH, y)
    .lineWidth(0.6).strokeColor(colors.border).stroke();
  doc.fillColor(colors.mid).font('Helvetica').fontSize(8)
    .text('Subtotal', CONTENT_LEFT + 10, y + 7, { width: 150, lineBreak: false });
  doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
    .text(amount, CONTENT_LEFT + 170, y + 7, { width: CONTENT_WIDTH - 180, align: 'right', lineBreak: false });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(8)
    .text('Taxes & Fees', CONTENT_LEFT + 10, y + 21, { width: 150, lineBreak: false });
  doc.fillColor(colors.dark).font('Helvetica').fontSize(8)
    .text('Rs. 0.00', CONTENT_LEFT + 170, y + 21, { width: CONTENT_WIDTH - 180, align: 'right', lineBreak: false });
  doc.fillColor(colors.light).font('Helvetica').fontSize(7)
    .text('(Inclusive)', CONTENT_LEFT + 10, y + 34, { width: 150, lineBreak: false });
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(9.5)
    .text('GRAND TOTAL', CONTENT_LEFT + 170, y + 34, {
      width: 78,
      characterSpacing: 0.35,
      lineBreak: false
    });
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(10)
    .text(amount, CONTENT_LEFT + 255, y + 34, { width: CONTENT_WIDTH - 265, align: 'right', lineBreak: false });
  doc.moveTo(CONTENT_LEFT, y + 51).lineTo(CONTENT_LEFT + CONTENT_WIDTH, y + 51)
    .lineWidth(0.6).strokeColor(colors.border).stroke();

  y += 59;
  doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, 50).fill(colors.cream);
  doc.rect(CONTENT_LEFT, y, 2.5, 50).fill(colors.gold);
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(7.5)
    .text('AMOUNT IN WORDS', CONTENT_LEFT + 10, y + 7, {
      width: CONTENT_WIDTH - 20,
      characterSpacing: 0.55,
      lineBreak: false
    });
  doc.fillColor(colors.dark).font('Helvetica-Oblique').fontSize(7.5)
    .text(amountInIndianWords(grandTotal), CONTENT_LEFT + 10, y + 20, {
      width: CONTENT_WIDTH - 20,
      height: 25,
      lineGap: 1
    });

  y += 58;
  doc.moveTo(CONTENT_LEFT, y).lineTo(CONTENT_LEFT + CONTENT_WIDTH, y)
    .lineWidth(0.5).strokeColor(colors.border).stroke();
  doc.fillColor(colors.emerald).font('Helvetica-Bold').fontSize(7.5)
    .text('TERMS & PAYMENT', CONTENT_LEFT + 10, y + 7, {
      width: CONTENT_WIDTH - 20,
      characterSpacing: 0.65,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.5)
    .text('Payment due within 30 days. Interest @18% p.a. after the due date.', CONTENT_LEFT + 10, y + 20, {
      width: CONTENT_WIDTH - 20,
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7.5)
    .text('Goods once sold will not be taken back.  E. & O.E.', CONTENT_LEFT + 10, y + 34, {
      width: CONTENT_WIDTH - 20,
      lineBreak: false
    });
}

function drawPageFooter(doc, pageNumber, pageCount, invoiceNo, authenticityCode, verifyUrl) {
  const colors = INVOICE_COLORS;
  const repeatedCode = `${authenticityCode}  `.repeat(8);
  doc.fillColor(colors.navy).fillOpacity(0.48).font('Courier').fontSize(2.4)
    .text(repeatedCode, CONTENT_LEFT, FOOTER_TOP, {
      width: CONTENT_WIDTH,
      lineBreak: false,
      characterSpacing: 0,
      height: 4
    });
  doc.fillOpacity(1);
  doc.moveTo(CONTENT_LEFT, FOOTER_TOP + 7).lineTo(INVOICE_WIDTH - CONTENT_LEFT, FOOTER_TOP + 7)
    .lineWidth(0.5).strokeColor(colors.gold).stroke();
  doc.fillColor(colors.navy).font('Courier-Bold').fontSize(10)
    .text(authenticityCode, CONTENT_LEFT, FOOTER_TOP + 14, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false
    });
  doc.fillColor(colors.mid).font('Helvetica').fontSize(7)
    .text('This code is sealed to the company, customer, balance and items on this invoice.', CONTENT_LEFT, FOOTER_TOP + 31, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false
    });
  doc.text('Any change to them makes the code invalid.', CONTENT_LEFT, FOOTER_TOP + 41, {
    width: CONTENT_WIDTH,
    align: 'center',
    lineBreak: false
  });
  doc.fillColor(colors.emerald).font('Helvetica-Bold').fontSize(7)
    .text('Click here to verify this invoice', CONTENT_LEFT, FOOTER_TOP + 51, {
      width: CONTENT_WIDTH,
      align: 'center',
      underline: true,
      lineBreak: false
    });
  doc.link(CONTENT_LEFT, FOOTER_TOP + 50, CONTENT_WIDTH, 10, verifyUrl);
  doc.fillColor(colors.light).font('Helvetica').fontSize(7)
    .text(`Invoice ${truncateToWidth(doc, invoiceNo, 'Helvetica', 7, 120)}  |  Page ${pageNumber} of ${pageCount}`, CONTENT_LEFT, FOOTER_TOP + 63, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false
    });
}

function renderInvoicePdf(res, items, company, grandTotal, authenticityCode, verifyUrl) {
  const first = items[0];
  const companyName = cleanString(company.name) || 'Company';
  const invoiceNo = cleanString(first.invoice_no);
  const doc = new PDFDocument({
    size: [INVOICE_WIDTH, INVOICE_HEIGHT],
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    bufferPages: true,
    info: {
      Title: `Sales Invoice ${invoiceNo}`,
      Author: companyName,
      Subject: authenticityCode
    }
  });
  doc.info.Subject = authenticityCode;
  doc.pipe(res);

  let pageCount = 0;
  let itemIndex = 0;
  const firstFinalCapacity = Math.floor(
    (FOOTER_TOP - FIRST_TABLE_TOP - 25 - FINAL_SECTION_HEIGHT) / ITEM_ROW_HEIGHT
  );
  const firstOpenCapacity = Math.floor(
    (FOOTER_TOP - FIRST_TABLE_TOP - 25) / ITEM_ROW_HEIGHT
  );
  const continuedFinalCapacity = Math.floor(
    (FOOTER_TOP - CONTINUED_TABLE_TOP - 25 - FINAL_SECTION_HEIGHT) / ITEM_ROW_HEIGHT
  );
  const continuedOpenCapacity = Math.floor(
    (FOOTER_TOP - CONTINUED_TABLE_TOP - 25) / ITEM_ROW_HEIGHT
  );

  while (itemIndex < items.length) {
    const isFirstPage = pageCount === 0;
    const tableTop = isFirstPage ? FIRST_TABLE_TOP : CONTINUED_TABLE_TOP;
    let capacity;
    let take;

    if (isFirstPage) {
      if (items.length <= firstFinalCapacity) {
        take = items.length;
      } else if (items.length <= firstFinalCapacity + continuedFinalCapacity) {
        take = firstFinalCapacity;
      } else if (items.length <= firstOpenCapacity + continuedFinalCapacity) {
        take = items.length - continuedFinalCapacity;
      } else {
        take = Math.min(
          firstOpenCapacity,
          Math.max(
            firstFinalCapacity,
            items.length - continuedFinalCapacity - continuedOpenCapacity
          )
        );
      }
    } else if (items.length - itemIndex <= continuedFinalCapacity) {
      take = items.length - itemIndex;
    } else {
      take = Math.min(
        continuedOpenCapacity,
        items.length - itemIndex - continuedFinalCapacity
      );
      take = Math.max(1, take);
    }

    if (!isFirstPage) doc.addPage({ size: [INVOICE_WIDTH, INVOICE_HEIGHT], margin: 0 });
    drawPageFrame(doc, companyName, invoiceNo);
    if (isFirstPage) drawFirstPageHeader(doc, items, company);
    else drawContinuedHeader(doc, invoiceNo, companyName);
    drawTableHeader(doc, tableTop);

    let y = tableTop + 25;
    for (let offset = 0; offset < take; offset += 1) {
      drawItemRow(doc, items[itemIndex], itemIndex, y);
      y += ITEM_ROW_HEIGHT;
      itemIndex += 1;
    }

    const isLastPage = itemIndex === items.length;
    if (isLastPage) {
      const minimumFinalY = FOOTER_TOP - FINAL_SECTION_HEIGHT;
      if (y > minimumFinalY) {
        throw new Error('Invoice items exceed the available page layout');
      }
      drawFinalSections(doc, y + 5, grandTotal, authenticityCode);
    }
    pageCount += 1;
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    drawPageFooter(doc, index + 1, range.count, invoiceNo, authenticityCode, verifyUrl);
  }
  doc.end();
}

router.get('/invoice/:id/verify', commonValidations.idValidation, async (req, res) => {
  try {
    const companyId = Number(req.query.company_id);
    if (!Number.isSafeInteger(companyId) || companyId < 1) {
      return ApiResponse.error(res, 'A valid company_id is required', 400);
    }
    const { items, company, grandTotal } = await ExportService.getInvoiceData(
      req.params.id,
      companyId
    );
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    const expectedCode = createAuthenticityCode(items, company || {}, grandTotal);
    const suppliedCode = String(req.query.code || '').trim().toUpperCase();
    const codePattern = /^[A-F0-9]{4}(?:-[A-F0-9]{4}){4}$/;
    const expectedBytes = Buffer.from(expectedCode, 'ascii');
    const suppliedBytes = Buffer.from(suppliedCode, 'ascii');
    const valid = codePattern.test(suppliedCode)
      && suppliedBytes.length === expectedBytes.length
      && crypto.timingSafeEqual(expectedBytes, suppliedBytes);

    return res.json({ valid, invoice_no: cleanString(items[0].invoice_no) });
  } catch (error) {
    console.error('Invoice Verification Error:', error);
    return ApiResponse.error(res, error.message);
  }
});

router.get('/invoice/:id', verifyToken, commonValidations.idValidation, async (req, res) => {
  try {
    const { items, company, grandTotal } = await ExportService.getInvoiceData(
      req.params.id,
      req.user.company_id
    );
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    const invoiceCompany = company || {};
    const authenticityCode = createAuthenticityCode(items, invoiceCompany, grandTotal);
    const fileInvoiceNo = safeFilePart(items[0].invoice_no, String(req.params.id));
    const publicApiUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = new URL(
      `/api/exports/invoice/${encodeURIComponent(req.params.id)}/verify`,
      publicApiUrl
    );
    verifyUrl.searchParams.set('code', authenticityCode);
    verifyUrl.searchParams.set('company_id', String(req.user.company_id));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SalesInvoice-${fileInvoiceNo}.pdf"`);

    renderInvoicePdf(res, items, invoiceCompany, grandTotal, authenticityCode, verifyUrl.href);
  } catch (error) {
    console.error('Invoice Error:', error);
    if (!res.headersSent) ApiResponse.error(res, error.message);
  }
});

module.exports = router;
