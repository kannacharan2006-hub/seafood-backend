const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const ApiResponse = require('../utils/response');

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await Database.getAll('SELECT id, name FROM categories ORDER BY name');
    ApiResponse.success(res, rows);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
