const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).json({ 
      success: false,
      message: 'Token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ 
      success: false,
      message: 'Token format invalid',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({ 
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      company_id: decoded.company_id
    };

    next();
  });
};

module.exports = verifyToken;
