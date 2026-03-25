const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg
    });
  }
  next();
};

const authValidation = {
  login: [
    body('email_or_phone').notEmpty().withMessage('Email or phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  
  forgotPassword: [
    body('email').isEmail().withMessage('Valid email is required'),
    validate
  ],
  
  registerCompany: [
    body('company_name').notEmpty().trim().withMessage('Company name is required'),
    body('owner_name').notEmpty().trim().withMessage('Owner name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().trim(),
    validate
  ],
  
  registerUser: [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['OWNER', 'EMPLOYEE']).withMessage('Invalid role'),
    body('phone').optional().trim(),
    validate
  ]
};

const purchaseValidation = {
  create: [
    body('vendor_id').isInt().withMessage('Vendor ID is required'),
    body('date').isDate().withMessage('Valid date is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.variant_id').isInt().withMessage('Variant ID is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    body('items.*.price_per_kg').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    validate
  ]
};

const exportValidation = {
  create: [
    body('customer_id').isInt().withMessage('Customer ID is required'),
    body('date').isDate().withMessage('Valid date is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.variant_id').isInt().withMessage('Variant ID is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    body('items.*.price_per_kg').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    validate
  ]
};

const conversionValidation = {
  create: [
    body('date').isDate().withMessage('Valid date is required'),
    body('raw_items').isArray({ min: 1 }).withMessage('At least one raw item is required'),
    body('final_items').isArray({ min: 1 }).withMessage('At least one final item is required'),
    body('raw_items.*.variant_id').isInt().withMessage('Variant ID is required for raw items'),
    body('raw_items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    body('final_items.*.variant_id').isInt().withMessage('Variant ID is required for final items'),
    body('final_items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    validate
  ]
};

const vendorValidation = {
  create: [
    body('name').notEmpty().trim().withMessage('Vendor name is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    validate
  ]
};

const customerValidation = {
  create: [
    body('name').notEmpty().trim().withMessage('Customer name is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    validate
  ]
};

const paymentValidation = {
  customerPayment: [
    body('customer_id').isInt().withMessage('Customer ID is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    validate
  ],
  
  vendorPayment: [
    body('vendor_id').isInt().withMessage('Vendor ID is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    validate
  ]
};

const categoryValidation = {
  create: [
    body('name').notEmpty().trim().withMessage('Category name is required'),
    validate
  ]
};

const itemValidation = {
  create: [
    body('name').notEmpty().trim().withMessage('Item name is required'),
    body('category_id').isInt().withMessage('Category ID is required'),
    validate
  ]
};

const variantValidation = {
  create: [
    body('item_id').isInt().withMessage('Item ID is required'),
    body('variant_name').notEmpty().trim().withMessage('Variant name is required'),
    validate
  ]
};

module.exports = {
  authValidation,
  purchaseValidation,
  exportValidation,
  conversionValidation,
  vendorValidation,
  customerValidation,
  paymentValidation,
  categoryValidation,
  itemValidation,
  variantValidation
};
