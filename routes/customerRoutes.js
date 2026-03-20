const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');


/* ================= ADD CUSTOMER ================= */
router.post('/', verifyToken, async (req, res) => {

    try {

        if (req.user.role !== 'OWNER') {
            return res.status(403).json({
                message: "Only Owner can add customers"
            });
        }

        const { name, phone, address } = req.body;
        const companyId = req.user.company_id;

        // Validation
        if (!name || name.trim() === "") {
            return res.status(400).json({
                message: "Customer name is required"
            });
        }

        // Check duplicate inside same company
        const [existing] = await db.promise().query(
            `SELECT id FROM customers 
                                                                                                                                                                                             WHERE name = ? AND company_id = ?`,
            [name, companyId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Customer already exists"
            });
        }

        // Insert with company_id
        await db.promise().query(
            `INSERT INTO customers (name, phone, address, company_id) 
                                                                                                                                                                                                                                                                                                                  VALUES (?, ?, ?, ?)`,
            [name.trim(), phone || null, address || null, companyId]
        );

        res.json({ message: "Customer added successfully" });

    } catch (error) {
        console.error("ADD CUSTOMER ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});


/* ================= GET CUSTOMERS ================= */
router.get('/', verifyToken, async (req, res) => {

    try {

        const companyId = req.user.company_id;

        const [customers] = await db.promise().query(
            `SELECT id, name, phone, address 
                                                                                                                                                                                                                                                                                                                                                                                                                   FROM customers
                                                                                                                                                                                                                                                                                                                                                                                                                                WHERE company_id = ?
                                                                                                                                                                                                                                                                                                                                                                                                                                             ORDER BY name ASC`,
            [companyId]
        );

        res.json(customers);

    } catch (error) {
        console.error("GET CUSTOMER ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;