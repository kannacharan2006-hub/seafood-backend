const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth routes
  message: {
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    message: 'Too many login attempts, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 payment requests per minute
  message: {
    message: 'Too many payment requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for general API
  message: {
    message: 'Too many API requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const dataEntryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for data entry (purchase, export, etc)
  message: {
    message: 'Too many data entry requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    message: 'Too many search requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  limiter,
  authLimiter,
  loginLimiter,
  paymentLimiter,
  apiLimiter,
  dataEntryLimiter,
  searchLimiter
};
