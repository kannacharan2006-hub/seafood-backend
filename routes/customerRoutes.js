const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { customerValidation } = require('../config/validation');
const CustomerService = require('../services/customerService');
const ApiResponse = require('../utils/response');

router.post('/', verifyToken, customerValidation.create, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const result = await CustomerService.createCustomer(req.user.company_id, name, phone, address);
    ApiResponse.success(res, result, 'Customer created');
  } catch (error) {
    if (error.message === "Customer already exists") {
      ApiResponse.error(res, error.message, 400);
    } else {
      ApiResponse.error(res, error.message);
    }
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const customers = await CustomerService.getCustomers(req.user.company_id);
    ApiResponse.success(res, customers);
  } catch (error) {
    ApiResponse.error(res, error.message);
  }
});

module.exports = router;
