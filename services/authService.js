const Database = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const EmailTemplates = require('../config/emailTemplates');
const logger = require('../config/logger');
const crypto = require('crypto');
const TokenService = require('./tokenService');

let transporter = null;

const getTransporter = () => {
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
};

const sendEmail = async (to, subject, html) => {
  const mailer = getTransporter();
  
  if (!mailer) {
    logger.warn('Email not configured - set EMAIL_USER and EMAIL_PASS in .env');
    return false;
  }
  
  try {
    await mailer.sendMail({
      from: `"Seafood ERP" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error('Email send failed', { error: error.message, to, subject });
    return false;
  }
};

class AuthService {
  static async login(emailOrPhone, password) {
    const isEmail = emailOrPhone.includes('@');
    let query = isEmail 
      ? 'SELECT * FROM users WHERE email = ?' 
      : 'SELECT * FROM users WHERE phone = ?';
    
    const results = await Database.execute(query, [emailOrPhone]);
    
    if (results.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = TokenService.generateRefreshToken();
    const refreshExpiry = await TokenService.saveRefreshToken(user.id, refreshToken);

    return {
      message: 'Login successful',
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        company_id: user.company_id
      }
    };
  }

  static async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token required');
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      const isValid = await TokenService.verifyRefreshToken(decoded.id, refreshToken);
      if (!isValid) {
        throw new Error('Invalid or expired refresh token');
      }

      const user = await Database.getOne('SELECT * FROM users WHERE id = ?', [decoded.id]);
      if (!user) {
        throw new Error('User not found');
      }

      const newAccessToken = TokenService.generateAccessToken(user);

      return {
        token: newAccessToken,
        expiresIn: 3600 // 1 hour in seconds
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        throw new Error('Invalid or expired refresh token');
      }
      throw error;
    }
  }

  static async logout(userId, refreshToken) {
    if (refreshToken) {
      await TokenService.revokeRefreshToken(userId);
    }
    return { message: 'Logged out successfully' };
  }

  static async forgotPassword(email) {
    const users = await Database.execute(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      throw new Error('No account found with this email');
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 6);

    await Database.execute(
      'UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [resetToken, user.id]
    );

    const emailSent = await sendEmail(
      email,
      'Password Reset - Seafood ERP',
      EmailTemplates.passwordReset(resetToken, user.name)
    );

    if (!emailSent) {
      throw new Error('Failed to send email. Please try again later.');
    }

    logger.info(`Password reset OTP sent to ${email}`);
    return { success: true, message: 'OTP sent to email!' };
  }

  static async resetPassword(email, otp, newPassword) {
    const users = await Database.execute(
      'SELECT id, name, reset_token, reset_token_expiry FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      throw new Error('Invalid email or OTP');
    }

    const user = users[0];

    if (!user.reset_token || user.reset_token !== otp) {
      throw new Error('Invalid OTP');
    }

    const now = new Date();
    const expiry = new Date(user.reset_token_expiry);
    
    if (now > expiry) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await Database.execute(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    logger.info(`Password reset successful for ${email}`);

    await sendEmail(email, 'Password Changed - Seafood ERP', EmailTemplates.passwordResetSuccess(user.name));

    return { success: true, message: 'Password reset successful!' };
  }

  static async registerUser(name, email, password, role, phone, company_id) {
    const hashedPassword = await bcrypt.hash(password, 10);

    await Database.execute(
      `INSERT INTO users (name, email, password_hash, role, phone, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, role, phone, company_id]
    );
    
    return { message: "User registered successfully" };
  }

  static async registerCompany(company_name, owner_name, email, password, phone) {
    const hashedPassword = await bcrypt.hash(password, 10);
    let companyId;
    let userId;

    const connection = await Database.beginTransaction();

    try {
      const companyResult = await Database.execute(
        `INSERT INTO companies (name, phone, email) VALUES (?, ?, ?)`,
        [company_name, phone, email],
        connection
      );
      companyId = companyResult.insertId;

      const userResult = await Database.execute(
        `INSERT INTO users (name, email, password_hash, role, phone, company_id) VALUES (?, ?, ?, 'OWNER', ?, ?)`,
        [owner_name, email, hashedPassword, phone, companyId],
        connection
      );
      userId = userResult.insertId;

      await Database.commit(connection);

      await sendEmail(email, 'Welcome to Seafood ERP', EmailTemplates.welcomeEmail(owner_name, email, company_name));

      await this.seedDefaultData(companyId);

      const token = TokenService.generateAccessToken({
        id: userId,
        role: "OWNER",
        company_id: companyId
      });

      const refreshToken = TokenService.generateRefreshToken();
      await TokenService.saveRefreshToken(userId, refreshToken);

      return {
        message: "Company created successfully",
        token,
        refreshToken: refreshToken,
        expiresIn: 3600,
        user: {
          id: userId,
          name: owner_name,
          email,
          role: "OWNER",
          company_id: companyId
        }
      };
      } catch (error) {
        await Database.rollback(connection);
        throw error;
      }
    }

    static async seedDefaultData(companyId) {
    const defaultData = [
      { category: 'Shrimps', items: [
        { name: 'Tiger shrimp', variants: ['10','15','20','25','30','35','40','45','50','60','70','80','90','100','110','115','120','130','140'] },
        { name: 'Vannamei shrimp', variants: ['10','15','20','25','30','35','40','45','50','60','70','80','90','100','110','115','120','130','140'] }
      ]},
      { category: 'Crabs', items: [
        { name: 'Crabs', variants: ['XXL','XL','BIG','MEDIUM','OL','RED','XL-WATER','BIG-WATER','MED-WATER','DEAD'] }
      ]},
      { category: 'Fishes', items: [
        { name: 'Regular-fish', variants: ['seer','promfet','botchee','korameen'] }
      ]}
    ];

    for (const cat of defaultData) {
      const catResult = await Database.execute(
        `INSERT INTO categories (name, company_id) VALUES (?, ?)`,
        [cat.category, companyId]
      );
      const categoryId = catResult.insertId;

      for (const item of cat.items) {
        const itemResult = await Database.execute(
          `INSERT INTO items (name, category_id, company_id) VALUES (?, ?, ?)`,
          [item.name, categoryId, companyId]
        );
        const itemId = itemResult.insertId;

        for (const variant of item.variants) {
          await Database.execute(
            `INSERT INTO variants (variant_name, item_id, company_id) VALUES (?, ?, ?)`,
            [variant, itemId, companyId]
          );
        }
      }
    }
  }

  static async sendPasswordChangeNotification(email, userName) {
    await sendEmail(email, 'Password Changed - Seafood ERP', EmailTemplates.passwordResetSuccess(userName));
  }
}

module.exports = AuthService;
