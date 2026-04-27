const Database = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

class TokenService {
  static generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, company_id: user.company_id },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  static generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  static async saveRefreshToken(userId, refreshToken) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await Database.delete('refresh_tokens', 'user_id = ?', [userId]);
    
    await Database.insert('refresh_tokens', {
      user_id: userId,
      token_hash: hashedToken,
      expires_at: expiryDate,
      created_at: new Date()
    });

    return expiryDate;
  }

  static async verifyRefreshToken(userId, refreshToken) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const stored = await Database.getOne(
      'SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()',
      [userId, hashedToken]
    );

    return stored !== null;
  }

  static async revokeRefreshToken(userId) {
    await Database.delete('refresh_tokens', 'user_id = ?', [userId]);
  }

  static async revokeAllUserTokens(userId) {
    await Database.delete('refresh_tokens', 'user_id = ?', [userId]);
  }

  static async cleanupExpiredTokens() {
    await Database.execute('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  }

  static decodeAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

module.exports = TokenService;
