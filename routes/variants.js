const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT v.id, c.name AS category, i.name AS item_name, v.variant_name AS grade
      FROM variants v
      JOIN items i ON v.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE v.company_id = ?
      ORDER BY c.name, i.name, v.variant_name
    `, [req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/:itemId', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT id, variant_name FROM variants WHERE item_id = ? AND company_id = ? ORDER BY variant_name
    `, [req.params.itemId, req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
