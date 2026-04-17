const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/:categoryId', verifyToken, async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    const [rows] = await db.promise().query(
      `SELECT id, name
       FROM items
       WHERE category_id = ?
       ORDER BY name`,
      [categoryId]
    );

    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
