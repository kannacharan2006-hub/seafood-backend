const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(
      'SELECT id, name, category_id FROM items WHERE company_id = ? ORDER BY name',
      [req.user.company_id]
    );
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/:categoryId', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(
      'SELECT id, name FROM items WHERE category_id = ? AND company_id = ? ORDER BY name',
      [req.params.categoryId, req.user.company_id]
    );
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, category_id } = req.body;
    if (!name || !category_id) {
      return ApiResponse.error(res, 'Name and category_id are required', 400);
    }
    const result = await Database.insert('items', {
      name,
      category_id: parseInt(category_id),
      company_id: req.user.company_id
    });
    ApiResponse.success(res, { id: result.insertId, name, category_id }, 'Item created', 201);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, category_id } = req.body;
    if (!name) {
      return ApiResponse.error(res, 'Name is required', 400);
    }
    const updateData = { name };
    if (category_id) {
      updateData.category_id = parseInt(category_id);
    }
    await Database.update('items', updateData, 'id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
    ApiResponse.success(res, null, 'Item updated');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id <= 0) {
      return ApiResponse.error(res, 'Invalid item ID', 400);
    }
    await Database.delete('items', 'id = ? AND company_id = ?', [id, req.user.company_id]);
    ApiResponse.success(res, null, 'Item deleted');
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
