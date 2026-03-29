const Database = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const EmailTemplates = require('../config/emailTemplates');
const logger = require('../config/logger');
const crypto = require('crypto');

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
 
     const token = jwt.sign(
       { id: user.id, role: user.role, company_id: user.company_id },
       process.env.JWT_SECRET,
       { expiresIn: "7d" }
     );
 
     return {
       message: 'Login successful',
       token,
       user: {
         id: user.id,
         name: user.name,
         role: user.role,
         email: user.email,
         company_id: user.company_id
       }
     };
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

    const user = users[0];
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 6);

    await db.promise().query(
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

     const companyResult = await Database.execute(
       `INSERT INTO companies (name, phone, email) VALUES (?, ?, ?)`,
       [company_name, phone, email]
     );

     const companyId = companyResult.insertId;

     const userResult = await Database.execute(
       `INSERT INTO users (name, email, password_hash, role, phone, company_id) VALUES (?, ?, ?, 'OWNER', ?, ?)`,
       [owner_name, email, hashedPassword, phone, companyId]
     );

     const userId = userResult.insertId;

     await sendEmail(email, 'Welcome to Seafood ERP', EmailTemplates.welcomeEmail(owner_name, email, company_name));

     const token = jwt.sign(
       { id: userId, role: "OWNER", company_id: companyId },
       process.env.JWT_SECRET,
       { expiresIn: "1h" }
     );

     return {
       message: "Company created successfully",
       token,
       user: {
         id: userId,
         name: owner_name,
         email,
         role: "OWNER",
         company_id: companyId
       }
     };
   }

  static async sendPasswordChangeNotification(email, userName) {
    await sendEmail(email, 'Password Changed - Seafood ERP', EmailTemplates.passwordResetSuccess(userName));
  }
}

module.exports = AuthService;
