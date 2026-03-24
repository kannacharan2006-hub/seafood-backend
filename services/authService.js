const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

class AuthService {
  static async login(email, password) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return reject(new Error('Invalid credentials'));

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) return reject(new Error('Invalid credentials'));

        const token = jwt.sign(
          { id: user.id, role: user.role, company_id: user.company_id },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        resolve({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email,
            company_id: user.company_id
          }
        });
      });
    });
  }

  static async forgotPassword(email) {
    const [users] = await db.promise().query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      throw new Error('No account found with this email');
    }

    const user = users[0];
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    await db.promise().query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [resetToken, user.id]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      html: `<h1>${resetToken}</h1><p>Valid for 15 minutes</p>`
    });

    return { success: true, message: 'OTP sent to email!' };
  }

  static async registerUser(name, email, password, role, phone, company_id) {
    const hashedPassword = await bcrypt.hash(password, 10);

    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO users (name, email, password_hash, role, phone, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, role, phone, company_id],
        (err, result) => {
          if (err) return reject(err);
          resolve({ message: "User registered successfully" });
        }
      );
    });
  }

  static async registerCompany(company_name, owner_name, email, password, phone) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [companyResult] = await db.promise().query(
      `INSERT INTO companies (name, phone, email) VALUES (?, ?, ?)`,
      [company_name, phone, email]
    );

    const companyId = companyResult.insertId;

    const [userResult] = await db.promise().query(
      `INSERT INTO users (name, email, password_hash, role, phone, company_id) VALUES (?, ?, ?, 'OWNER', ?, ?)`,
      [owner_name, email, hashedPassword, phone, companyId]
    );

    const userId = userResult.insertId;

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
}

module.exports = AuthService;
