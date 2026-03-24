const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { authValidation } = require('../config/validation');
const { loginLimiter } = require('../config/rateLimit');
const AuthService = require('../services/authService');

// LOGIN
router.post('/login', loginLimiter, authValidation.login, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', authValidation.forgotPassword, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// REGISTER USER
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

// REGISTER COMPANY
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
