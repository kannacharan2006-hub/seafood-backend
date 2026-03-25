const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/authRoutes');
const db = require('../config/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  let testEmail = `test_${Date.now()}@test.com`;

  describe('POST /api/auth/login', () => {
    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email_or_phone: 'invalid@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for missing email_or_phone', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email_or_phone: 'test@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return 500 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('No account found with this email');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register-company', () => {
    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register-company')
        .send({
          company_name: 'Test Company'
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register-company')
        .send({
          company_name: 'Test Company',
          owner_name: 'Test Owner',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register-company')
        .send({
          company_name: 'Test Company',
          owner_name: 'Test Owner',
          email: 'test@valid.com',
          password: '123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
    });
  });
});
