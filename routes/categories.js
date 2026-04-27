const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll('SELECT id, name FROM categories WHERE company_id = ? ORDER BY name', [req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return ApiResponse.error(res, 'Category name is required', 400);
    }
    const result = await Database.insert('categories', {
      name,
      company_id: req.user.company_id
    });
    ApiResponse.success(res, { id: result.insertId, name }, 'Category created', 201);
  } catch (error) {
    if (error.message.includes('Duplicate')) {
      ApiResponse.error(res, 'Category already exists', 400);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return ApiResponse.error(res, 'Category name is required', 400);
    }
    await Database.update('categories', { name }, 'id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    ApiResponse.success(res, null, 'Category updated');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return ApiResponse.error(res, 'Invalid category ID', 400);
    }
    await Database.delete('categories', 'id = ? AND company_id = ?', [id, req.user.company_id]);
    ApiResponse.success(res, null, 'Category deleted');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
