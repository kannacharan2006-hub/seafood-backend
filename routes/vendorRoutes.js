const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { vendorValidation } = require('../config/validation');
const VendorService = require('../services/vendorService');
const ApiResponse = require('../utils/response');

router.post('/vendors', verifyToken, vendorValidation.create, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const result = await VendorService.createVendor(req.user.company_id, name, phone, address);
    ApiResponse.success(res, result, 'Vendor created');
  } catch (error) {
    if (error.message === "Vendor already exists") {
      ApiResponse.error(res, error.message, 400);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.get('/vendors', verifyToken, async (req, res) => {
  try {
    const vendors = await VendorService.getVendors(req.user.company_id);
    ApiResponse.success(res, vendors);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
