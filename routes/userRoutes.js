const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }
  try {
    const results = await Database.getAll(
      'SELECT id, name, role FROM users WHERE company_id = ? ORDER BY name ASC',
      [req.user.company_id]
    );
    ApiResponse.success(res, results);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }
  const { name, email, password, phone, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await Database.insert('users', {
      name,
      email,
      password_hash: hashedPassword,
      phone,
      role: role || 'EMPLOYEE',
      company_id: req.user.company_id
    });
    ApiResponse.success(res, { id: result.insertId }, 'Employee created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }
  try {
    await Database.delete('users', 'id = ?', [req.params.id]);
    ApiResponse.success(res, null, 'Employee deleted');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }
  const { name, email, phone } = req.body;
  try {
    await Database.update('users', { name, email, phone }, 'id = ?', [req.params.id]);
    ApiResponse.success(res, null, 'Employee updated');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
