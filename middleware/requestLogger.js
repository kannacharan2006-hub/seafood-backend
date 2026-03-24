const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { requestId } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    };

    if (req.user) {
      logData.userId = req.user.id;
      logData.companyId = req.user.company_id;
    }

    if (res.statusCode >= 500) {
      logger.error('Request completed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

module.exports = { requestIdMiddleware, requestLogger };
