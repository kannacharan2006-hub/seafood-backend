const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }

  const companyId = req.user.company_id;

  try {
    const [results] = await db.promise().query(
      `SELECT id, name, role FROM users WHERE company_id = ? ORDER BY name ASC`,
      [companyId]
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

  const companyId = req.user.company_id;
  const { name, email, password, phone, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.promise().query(
      `INSERT INTO users (name, email, password_hash, phone, role, company_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, phone, role || 'EMPLOYEE', companyId]
    );

    ApiResponse.success(res, { id: result.insertId }, 'Employee created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }

  const id = req.params.id;

  try {
    await db.promise().query(`DELETE FROM users WHERE id = ?`, [id]);
    ApiResponse.success(res, null, 'Employee deleted');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'OWNER') {
    return ApiResponse.forbidden(res, 'Access denied');
  }

  const id = req.params.id;
  const { name, email, phone } = req.body;

  try {
    await db.promise().query(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone, id]
    );
    ApiResponse.success(res, null, 'Employee updated');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
