const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const verifyToken = require('../middleware/auth');


/* ================= LIST COMPANY USERS ================= */

router.get('/', verifyToken, async (req, res) => {

  const userRole = req.user.role;

  if (userRole !== 'OWNER') {
    return res.status(403).json({
      message: 'Access denied'
    });
  }

  const companyId = req.user.company_id;

  try {

    const [results] = await db.promise().query(
      `SELECT id, name, role
FROM users
WHERE company_id = ?
ORDER BY name ASC`,
      [companyId]
    );

    res.json(results);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});
/* ================= CREATE EMPLOYEE ================= */

router.post('/', verifyToken, async (req, res) => {

  console.log("BODY:", req.body);
  console.log("USER:", req.user);

  const userRole = req.user.role;

  if (userRole !== 'OWNER') {
  return res.status(403).json({ message: 'Access denied' });
  }

  const companyId = req.user.company_id;

  const { name, email, password, phone, role } = req.body;

  try {

  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await db.promise().query(
  `INSERT INTO users (name, email, password_hash, phone, role, company_id)
  VALUES (?, ?, ?, ?, ?, ?)`,
  [name, email, hashedPassword, phone, role || 'EMPLOYEE', companyId]
  );

  console.log("INSERT RESULT:", result);

  res.status(201).json({ message: "Employee created" });

  } catch (error) {

  console.log("ERROR:", error);

  res.status(500).json({ error: error.message });

  }

  });
/* ================= DELETE EMPLOYEE ================= */

router.delete('/:id', verifyToken, async (req, res) => {

const userRole = req.user.role;

if (userRole !== 'OWNER') {
return res.status(403).json({ message: 'Access denied' });
}

const id = req.params.id;

try {

await db.promise().query(
`DELETE FROM users WHERE id = ?`,
[id]
);

res.json({ message: "Employee deleted" });

} catch (error) {

res.status(500).json({ error: error.message });

}

});

/* ================= UPDATE EMPLOYEE ================= */

router.put('/:id', verifyToken, async (req, res) => {

const userRole = req.user.role;

if (userRole !== 'OWNER') {
return res.status(403).json({ message: 'Access denied' });
}

const id = req.params.id;
const { name, email, phone } = req.body;

try {

await db.promise().query(
`UPDATE users
SET name = ?, email = ?, phone = ?
WHERE id = ?`,
[name, email, phone, id]
);

res.json({ message: "Employee updated" });

} catch (error) {

res.status(500).json({ error: error.message });

}

});

module.exports = router;