const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { customerValidation } = require('../config/validation');
const CustomerService = require('../services/customerService');

router.post('/', verifyToken, customerValidation.create, async (req, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: "Only Owner can add customers" });
    }
    const { name, phone, address } = req.body;
    const result = await CustomerService.createCustomer(req.user.company_id, name, phone, address);
    res.json(result);
  } catch (error) {
    res.status(error.message === "Customer already exists" ? 400 : 500).json({ message: error.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const customers = await CustomerService.getCustomers(req.user.company_id);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
