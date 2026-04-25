const express = require('express');
const router = express.Router();
const Database = require('../config/database');
const verifyToken = require('../middleware/auth');
const { commonValidations } = require('../config/validation');
const ApiResponse = require('../utils/response');

router.get('/:categoryId', verifyToken, commonValidations.idValidation, async (req, res) => {
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

module.exports = router;
