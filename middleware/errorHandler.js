const AppError = require('../config/errors');

module.exports = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  
  if (!err.isOperational) {
    console.error('UNEXPECTED ERROR:', {
      requestId,
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Something went wrong. Please try again later.';

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};