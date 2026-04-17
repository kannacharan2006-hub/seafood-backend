const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT v.id, c.name AS category, i.name AS item_name, v.variant_name AS grade
       FROM variants v
       JOIN items i ON v.item_id = i.id
       JOIN categories c ON i.category_id = c.id
       ORDER BY c.name, i.name, v.variant_name`
    );
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

router.get('/:itemId', verifyToken, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const [rows] = await db.promise().query(
      `SELECT id, variant_name
       FROM variants
       WHERE item_id = ?
       ORDER BY variant_name`,
      [itemId]
    );
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
