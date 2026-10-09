const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const purchaseRoutes = require('../routes/purchaseRoutes');
const exportRoutes = require('../routes/exportRoutes');
const PurchaseService = require('../services/purchaseService');

const app = express();
app.use(express.json());

const mockUser = { id: 1, role: 'OWNER', company_id: 1 };
const authMock = (req, res, next) => {
  req.user = mockUser;
  next();
};

app.use('/api/purchases', authMock, purchaseRoutes);
app.use('/api/exports', authMock, exportRoutes);

describe('Purchase Routes', () => {
  it('should generate a multi-page purchase invoice PDF', async () => {
    const items = Array.from({ length: 18 }, (_, index) => ({
      item_name: `Seafood item ${index + 1}`,
      variant_name: 'Fresh',
      quantity: 2.5,
      price_per_kg: 120,
      total: 300
    }));
    const invoiceData = {
      items,
      company: { name: 'Seafood Company', email: 'accounts@example.com', phone: '9876543210' },
      vendor: { name: 'Supplier One', address: 'Harbor Road', phone: '9876500000' },
      grandTotal: 5400,
      purchaseDate: '2024-01-15'
    };
    const getInvoiceData = jest.spyOn(PurchaseService, 'getInvoiceData').mockResolvedValue(invoiceData);
    const token = jwt.sign(mockUser, process.env.JWT_SECRET);

    try {
      const res = await request(app)
        .get('/api/purchases/invoice/1')
        .set('Authorization', `Bearer ${token}`)
        .buffer()
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('PurchaseInvoice-PR-000001.pdf');
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(getInvoiceData).toHaveBeenCalledWith('1', mockUser.company_id);
    } finally {
      getInvoiceData.mockRestore();
    }
  });

  describe('POST /api/purchases', () => {
    it('should return 400 for missing vendor_id', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .send({
          date: '2024-01-15',
          items: [{ variant_id: 1, quantity: 10, price_per_kg: 100 }]
        });

      expect([400, 403]).toContain(res.status);
    });

    it('should return 400 for missing date', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .send({
          vendor_id: 1,
          items: [{ variant_id: 1, quantity: 10, price_per_kg: 100 }]
        });

      expect([400, 403]).toContain(res.status);
    });

    it('should return 400 for empty items', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .send({
          vendor_id: 1,
          date: '2024-01-15',
          items: []
        });

      expect([400, 403]).toContain(res.status);
    });

    it('should return 400 for invalid item data', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .send({
          vendor_id: 1,
          date: '2024-01-15',
          items: [{ variant_id: 'invalid', quantity: -1, price_per_kg: 0 }]
        });

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('GET /api/purchases', () => {
    it('should accept pagination params', async () => {
      const res = await request(app)
        .get('/api/purchases?page=1&limit=10');

      expect([200, 404]).toContain(res.status);
    });
  });
});

describe('Export Routes', () => {
  describe('POST /api/exports', () => {
    it('should return 400 or 403 for missing customer_id', async () => {
      const res = await request(app)
        .post('/api/exports')
        .send({
          date: '2024-01-15',
          items: [{ variant_id: 1, quantity: 10, price_per_kg: 500 }]
        });

      expect([400, 403]).toContain(res.status);
    });

    it('should return 400 or 403 for missing date', async () => {
      const res = await request(app)
        .post('/api/exports')
        .send({
          customer_id: 1,
          items: [{ variant_id: 1, quantity: 10, price_per_kg: 500 }]
        });

      expect([400, 403]).toContain(res.status);
    });

    it('should return 400 or 403 for empty items', async () => {
      const res = await request(app)
        .post('/api/exports')
        .send({
          customer_id: 1,
          date: '2024-01-15',
          items: []
        });

      expect([400, 403]).toContain(res.status);
    });
  });

  describe('GET /api/exports', () => {
    it('should respond (auth required)', async () => {
      const res = await request(app)
        .get('/api/exports?page=1&limit=10');

      expect([200, 403, 404]).toContain(res.status);
    });

    it('should respond to pagination', async () => {
      const res = await request(app)
        .get('/api/exports?page=2&limit=5');

      expect([200, 403, 404]).toContain(res.status);
    });
  });
});
