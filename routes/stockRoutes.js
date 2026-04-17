const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/raw-stock', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT
        i.name AS item_name,
        v.variant_name,
        c.name AS category_name,
        rs.available_qty
      FROM raw_stock rs
      JOIN variants v ON rs.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE rs.available_qty > 0 AND rs.company_id = ?
    `, [req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/final-stock', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll(`
      SELECT
        i.name AS item_name,
        v.variant_name,
        c.name AS category_name,
        fs.available_qty
      FROM final_stock fs
      JOIN variants v ON fs.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE fs.available_qty > 0 AND fs.company_id = ?
    `, [req.user.company_id]);
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
