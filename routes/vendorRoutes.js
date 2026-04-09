const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { vendorValidation } = require('../config/validation');
const VendorService = require('../services/vendorService');

router.post('/vendors', verifyToken, vendorValidation.create, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const result = await VendorService.createVendor(req.user.company_id, name, phone, address);
    res.json(result);
  } catch (error) {
    res.status(error.message === "Vendor already exists" ? 400 : 500).json({ message: error.message });
  }
});

router.get('/vendors', verifyToken, async (req, res) => {
  try {
    const vendors = await VendorService.getVendors(req.user.company_id);
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
