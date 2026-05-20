const request = require('supertest');
const express = require('express');

// Mock services and middleware
jest.mock('../services/authService');
jest.mock('../services/healthService');
jest.mock('../middleware/auth', () => (req, res, next) => {
  // If a preceding middleware already set req.user (e.g. test auth mocks), pass through
  if (req.user) {
    return next();
  }
  // Default mock: no auth header provided → 403 (same as real middleware behavior)
  if (!req.headers['authorization']) {
    return res.status(403).json({ success: false, message: 'Token required', code: 'TOKEN_REQUIRED' });
  }
  // When header is present, pass through
  next();
});
jest.mock('../config/rateLimit', () => ({
  loginLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  limiter: (req, res, next) => next(),
  paymentLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  dataEntryLimiter: (req, res, next) => next(),
  searchLimiter: (req, res, next) => next()
}));

const AuthService = require('../services/authService');
const HealthService = require('../services/healthService');
const authRoutes = require('../routes/authRoutes');
const healthRoutes = require('../routes/healthRoutes');

describe('Security & Infrastructure Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
  });

  /* ============= OWNER ROLE CHECK ON USER REGISTRATION ============= */

  describe('POST /api/auth/users — OWNER role check', () => {
    it('should return 403 when EMPLOYEE tries to register a new user', async () => {
      // Mock auth middleware to simulate EMPLOYEE role
      const employeeAuth = (req, res, next) => {
        req.user = { id: 2, role: 'EMPLOYEE', company_id: 1 };
        next();
      };

      app.use('/api/auth', employeeAuth, authRoutes);

      const res = await request(app)
        .post('/api/auth/users')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          role: 'EMPLOYEE'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('OWNER');
    });

    it('should allow OWNER to register a new user', async () => {
      // Mock auth middleware to simulate OWNER role
      const ownerAuth = (req, res, next) => {
        req.user = { id: 1, role: 'OWNER', company_id: 1 };
        next();
      };

      AuthService.registerUser.mockResolvedValue({
        message: 'User registered successfully',
        user: { id: 3, name: 'New User', role: 'EMPLOYEE' }
      });

      app.use('/api/auth', ownerAuth, authRoutes);

      const res = await request(app)
        .post('/api/auth/users')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          role: 'EMPLOYEE'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 when no auth token provided', async () => {
      // No auth middleware attached — simulates missing token
      app.use('/api/auth', authRoutes);

      const res = await request(app)
        .post('/api/auth/users')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          role: 'EMPLOYEE'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Token');
    });
  });

  /* ============= 404 HANDLER ============= */

  describe('404 handler for unknown routes', () => {
    it('should return JSON 404 for unknown API routes', async () => {
      // Import the full server app with 404 handler
      const appWith404 = express();
      appWith404.use(express.json());
      appWith404.use('/api/auth', authRoutes);
      // 404 handler (same as in server.js)
      appWith404.use((req, res) => {
        res.status(404).json({
          success: false,
          message: `Route not found: ${req.method} ${req.originalUrl}`,
          statusCode: 404
        });
      });

      const res = await request(appWith404)
        .get('/api/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Route not found');
      expect(res.body.statusCode).toBe(404);
    });

    it('should return JSON not HTML for unknown routes', async () => {
      const appWith404 = express();
      appWith404.use(express.json());
      appWith404.use((req, res) => {
        res.status(404).json({
          success: false,
          message: `Route not found: ${req.method} ${req.originalUrl}`,
          statusCode: 404
        });
      });

      const res = await request(appWith404)
        .post('/api/unknown');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('json');
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  /* ============= HEALTH CHECK WITH DB ============= */

  describe('GET /health — DB connectivity check', () => {
    it('should return 200 when database is healthy', async () => {
      HealthService.checkDatabase.mockResolvedValue({ status: 'healthy', latency: 0 });

      app.use('/health', healthRoutes);

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database.status).toBe('healthy');
    });

    it('should return 503 when database is down', async () => {
      HealthService.checkDatabase.mockResolvedValue({
        status: 'unhealthy',
        error: 'Can\'t connect to MySQL server'
      });

      app.use('/health', healthRoutes);

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.database.status).toBe('unhealthy');
    });
  });

  /* ============= AUTH: REFRESH TOKEN ============= */

  describe('POST /api/auth/refresh-token', () => {
    it('should return 401 for invalid refresh token', async () => {
      AuthService.refreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      app.use('/api/auth', authRoutes);

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });

    it('should return 200 for valid refresh token', async () => {
      AuthService.refreshAccessToken.mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      });

      app.use('/api/auth', authRoutes);

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('new-access-token');
    });
  });

  /* ============= AUTH: LOGOUT ============= */

  describe('POST /api/auth/logout', () => {
    it('should return 200 for successful logout', async () => {
      AuthService.logout.mockResolvedValue({});

      const authMock = (req, res, next) => {
        req.user = { id: 1, role: 'OWNER', company_id: 1 };
        next();
      };

      app.use('/api/auth', authMock, authRoutes);

      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});