const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { authValidation } = require('../config/validation');
const { loginLimiter } = require('../config/rateLimit');
const AuthService = require('../services/authService');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, authValidation.login, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', authValidation.forgotPassword, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await AuthService.resetPassword(email, otp, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users:
 *   post:
 *     summary: Register new user (Owner only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               role:
 *                 type: string
 *                 enum: [OWNER, EMPLOYEE]
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       403:
 *         description: Access denied
 */
router.post('/users', verifyToken, authValidation.registerUser, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const company_id = req.user.company_id;
    const result = await AuthService.registerUser(name, email, password, role, phone, company_id);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
});

/**
 * @swagger
 * /api/auth/register-company:
 *   post:
 *     summary: Register new company with owner
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *               - owner_name
 *               - email
 *               - password
 *             properties:
 *               company_name:
 *                 type: string
 *               owner_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register-company', authValidation.registerCompany, async (req, res) => {
  try {
    const { company_name, owner_name, email, password, phone } = req.body;
    const result = await AuthService.registerCompany(company_name, owner_name, email, password, phone);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
