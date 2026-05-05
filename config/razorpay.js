const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_xxx'
});

module.exports = razorpay;
