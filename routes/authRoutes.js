const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/auth');
const { authValidation } = require('../config/validation');

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({

  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});



// ==================================================================================================
// LOGIN
// ==============================================================
router.post('/login', authValidation.login, async (req, res) => {

const { email, password } = req.body;

const sql = 'SELECT * FROM users WHERE email = ?';

db.query(sql, [email], async (err, results) => {

if (err) {
return res.status(500).json(err);
}

if (results.length === 0) {
return res.status(401).json({ message: 'Invalid credentials' });
}

const user = results[0];

// Compare password
const isMatch = await bcrypt.compare(password, user.password_hash);

if (!isMatch) {
return res.status(401).json({ message: 'Invalid credentials' });
}

// Create JWT with company_id
const token = jwt.sign(
{
id: user.id,
role: user.role,
company_id: user.company_id
},
process.env.JWT_SECRET,
{ expiresIn: "7d" }
);

res.json({
message: 'Login successful',
token: token,
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


// ======================
// FORGOT PASSWORD
// ======================
router.post('/forgot-password', authValidation.forgotPassword, async (req, res) => {
  const { email } = req.body;

  try {
    const [users] = await db.promise().query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'No account found with this email' });
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

    res.json({ success: true, message: 'OTP sent to email!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send email' });
  }
});


// ======================
// REGISTER USER
// ======================
router.post('/users', verifyToken, authValidation.registerUser, async (req, res) => {

  const { name, email, password, role, phone } = req.body;

  const company_id = req.user.company_id;

  try {

  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `
  INSERT INTO users
  (name, email, password_hash, role, phone, company_id)
  VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
  sql,
  [name, email, hashedPassword, role, phone, company_id],
  (err, result) => {

  if (err) {
  return res.status(500).json(err);
  }

  res.status(201).json({
  message: "User registered successfully"
  });

  }
  );

  } catch (error) {
  res.status(500).json(error);
  }

  });


  /* ================= COMPANY REGISTER ================= */

router.post('/register-company', authValidation.registerCompany, async (req, res) => {

const { company_name, owner_name, email, password, phone } = req.body;

if (!company_name || !owner_name || !email || !password) {
return res.status(400).json({
message: "All fields required"
});
}

try {

const hashedPassword = await bcrypt.hash(password, 10);

/* 1️⃣ Create company */

const [companyResult] = await db.promise().query(
`INSERT INTO companies (name, phone, email)
VALUES (?, ?, ?)`,
[company_name, phone, email]
);

const companyId = companyResult.insertId;

/* 2️⃣ Create owner user */

const [userResult] = await db.promise().query(
`INSERT INTO users
(name, email, password_hash, role, phone, company_id)
VALUES (?, ?, ?, 'OWNER', ?, ?)`,
[owner_name, email, hashedPassword, phone, companyId]
);

const userId = userResult.insertId;

/* 3️⃣ Create JWT */

const token = jwt.sign(
{
id: userId,
role: "OWNER",
company_id: companyId
},
process.env.JWT_SECRET,
{ expiresIn: "1h" }
);

res.status(201).json({
message: "Company created successfully",
token,
user: {
id: userId,
name: owner_name,
email,
role: "OWNER",
company_id: companyId
}
});

} catch (error) {

res.status(500).json({
message: error.message
});

}

});





module.exports = router;