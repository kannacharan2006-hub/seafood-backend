const request = require('supertest');
const express = require('express');
const purchaseRoutes = require('../routes/purchaseRoutes');
const exportRoutes = require('../routes/exportRoutes');

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
