const Database = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const EmailTemplates = require('../config/emailTemplates');
const logger = require('../config/logger');
const crypto = require('crypto');
const https = require('https');
const TokenService = require('./tokenService');

const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn('Email not configured - set RESEND_API_KEY in .env');
    return false;
  }

  return new Promise((resolve) => {
    const data = JSON.stringify({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          logger.info(`Email sent to ${to}: ${subject}`);
          resolve(true);
        } else {
          logger.error('Email send failed', { status: res.statusCode, body, to, subject });
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('Email send error', { error: err.message, to, subject });
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      logger.error('Email send timeout', { to, subject });
      resolve(false);
    });

    req.write(data);
    req.end();
  });
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
      const stored = await TokenService.verifyRefreshTokenRecord(refreshToken);
      if (!stored) {
        throw new Error('Invalid or expired refresh token');
      }

      const user = await Database.getOne('SELECT * FROM users WHERE id = ?', [stored.user_id]);
      if (!user) {
        throw new Error('User not found');
      }

      const newAccessToken = TokenService.generateAccessToken(user);

      return {
        token: newAccessToken,
        expiresIn: 3600
      };
    } catch (error) {
      if (error.message === 'Invalid or expired refresh token' || error.message === 'User not found') {
        throw error;
      }
      throw new Error('Invalid or expired refresh token');
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
    const resetToken = String(Math.floor(100000 + Math.random() * 900000));

    await Database.execute(
      'UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [resetToken, user.id]
    );

    // Fire email in background (non-blocking) - don't await
    sendEmail(
      email,
      'Password Reset - Seafood ERP',
      EmailTemplates.passwordReset(resetToken, user.name)
    ).catch(err => logger.error('Password reset email failed', { error: err.message, email }));

    logger.info(`Password reset OTP for ${email}: ${resetToken}`);
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

    sendEmail(email, 'Password Changed - Seafood ERP', EmailTemplates.passwordResetSuccess(user.name))
      .catch(err => logger.error('Password change notification email failed', { error: err.message, email }));

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

    // Pre-check for duplicates before transaction (prevents DB errors)
    const [existingEmail] = await Database.execute(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existingEmail && existingEmail.length > 0) {
      throw new Error('Email already registered');
    }

    if (phone) {
      const [existingPhone] = await Database.execute(
        'SELECT id FROM users WHERE phone = ?', [phone]
      );
      if (existingPhone && existingPhone.length > 0) {
        throw new Error('Phone number already registered');
      }
    }

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

      // Send email in background (non-blocking) - don't await
      sendEmail(email, 'Welcome to Seafood ERP', EmailTemplates.welcomeEmail(owner_name, email, company_name))
        .catch(err => logger.error('Welcome email failed', { error: err.message, email }));
      
      // Seed default data in background
      this.seedDefaultData(companyId).catch(err => 
        logger.error('Seed data failed', { error: err.message, companyId })
      );

      // Auto-create 90-day trial subscription
      this.createTrialSubscription(companyId).catch(err =>
        logger.error('Trial subscription creation failed', { error: err.message, companyId })
      );

      const token = TokenService.generateAccessToken({
        id: userId,
        role: "OWNER",
        company_id: companyId
      });

      const refreshToken = TokenService.generateRefreshToken();
      await TokenService.saveRefreshToken(userId, refreshToken);

      return {
        success: true,
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
        // Handle DB duplicate constraints (race condition safety)
        if (error.code === 'ER_DUP_ENTRY') {
          if (error.message.includes('phone')) {
            throw new Error('Phone number already registered');
          }
          if (error.message.includes('email')) {
            throw new Error('Email already registered');
          }
        }
        throw error;
      }
    }

    static async seedDefaultData(companyId) {
    const logger = require('../config/logger');
    
    try {
      // Check if company already has categories (idempotency check)
      const existingCategories = await Database.execute(
        'SELECT COUNT(*) as count FROM categories WHERE company_id = ?',
        [companyId]
      );
      
      if (existingCategories[0].count > 0) {
        logger.info('Default data already seeded, skipping', { companyId });
        return; // Already seeded, don't duplicate
      }

      const defaultData = [
        { 
          category: 'Shrimps', 
          items: [
            { name: 'Tiger shrimp', variants: ['10','15','20','25','30','35','40','45','50','60','70','80','90','100','110','115','120','130','140'] },
            { name: 'Vannamei shrimp', variants: ['10','15','20','25','30','35','40','45','50','60','70','80','90','100','110','115','120','130','140'] }
          ]
        },
        { 
          category: 'Crabs', 
          items: [
            { name: 'Crabs', variants: ['XXL','XL','BIG','MEDIUM','OL','RED','XL-WATER','BIG-WATER','MED-WATER','DEAD'] }
          ]
        },
        { 
          category: 'Fishes', 
          items: [
            { name: 'Regular-fish', variants: ['seer','promfet','botchee','korameen'] }
          ]
        }
      ];

      // Use transaction for atomic seeding
      const connection = await Database.beginTransaction();
      
      try {
        for (const cat of defaultData) {
          // Check if category already exists (safety check)
          const [existingCat] = await Database.execute(
            'SELECT id FROM categories WHERE name = ? AND company_id = ?',
            [cat.category, companyId],
            connection
          );
          
          let categoryId;
          if (existingCat && existingCat.length > 0) {
            categoryId = existingCat[0].id;
            logger.debug('Category already exists, reusing', { category: cat.category, companyId });
          } else {
            const catResult = await Database.execute(
              `INSERT INTO categories (name, company_id) VALUES (?, ?)`,
              [cat.category, companyId],
              connection
            );
            categoryId = catResult.insertId;
          }

          for (const item of cat.items) {
            // Check if item already exists
            const [existingItem] = await Database.execute(
              'SELECT id FROM items WHERE name = ? AND category_id = ? AND company_id = ?',
              [item.name, categoryId, companyId],
              connection
            );
            
            let itemId;
            if (existingItem && existingItem.length > 0) {
              itemId = existingItem[0].id;
            } else {
              const itemResult = await Database.execute(
                `INSERT INTO items (name, category_id, company_id) VALUES (?, ?, ?)`,
                [item.name, categoryId, companyId],
                connection
              );
              itemId = itemResult.insertId;
            }

            // Only seed variants if they don't exist
            const existingVariants = await Database.execute(
              'SELECT COUNT(*) as count FROM variants WHERE item_id = ? AND company_id = ?',
              [itemId, companyId],
              connection
            );
            
            if (existingVariants[0].count === 0) {
              for (const variant of item.variants) {
                await Database.execute(
                  `INSERT INTO variants (variant_name, item_id, company_id) VALUES (?, ?, ?)`,
                  [variant, itemId, companyId],
                  connection
                );
              }
            }
          }
        }
        
        await Database.commit(connection);
        logger.info('Default data seeded successfully', { 
          companyId,
          categories: defaultData.length,
          items: defaultData.reduce((sum, cat) => sum + cat.items.length, 0)
        });
        
      } catch (error) {
        await Database.rollback(connection);
        throw error;
      }
      
    } catch (error) {
      logger.error('Failed to seed default data', { error: error.message, companyId });
      throw error; // Re-throw so caller knows
    }
  }

  static async sendPasswordChangeNotification(email, userName) {
    await sendEmail(email, 'Password Changed - Seafood ERP', EmailTemplates.passwordResetSuccess(userName));
  }

  static async createTrialSubscription(companyId) {
    const plans = require('../config/subscriptionPlans');

    const trialPlan = plans.trial;

    // Check if company already has a subscription (idempotency)
    const existing = await Database.getOne(
      'SELECT id FROM subscriptions WHERE company_id = ?', [companyId]
    );
    if (existing) return;

    const trialEnd = new Date(Date.now() + (trialPlan.periodDays || 30) * 24 * 60 * 60 * 1000);

    await Database.insert('subscriptions', {
      company_id: companyId,
      plan_id: 'trial',
      status: 'active',
      current_period_start: new Date(),
      current_period_end: trialEnd
    });

    logger.info('Trial subscription created', { companyId, trialEnd });
  }
}

module.exports = AuthService;
