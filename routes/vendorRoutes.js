const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/auth');
const { vendorValidation } = require('../config/validation');


/* ================= ADD VENDOR ================= */
router.post('/vendors', verifyToken, vendorValidation.create, async (req, res) => {

    try {

        if (req.user.role !== 'OWNER') {
            return res.status(403).json({
                message: "Only Owner can add vendors"
            });
        }

        const { name, phone, address } = req.body;
        const companyId = req.user.company_id;

        // Validation
        if (!name || name.trim() === "") {
            return res.status(400).json({
                message: "Vendor name is required"
            });
        }

        // Check duplicate vendor INSIDE SAME COMPANY
        const [existing] = await db.promise().query(
            `SELECT id FROM vendors 
                                                                                                                                                                                             WHERE name = ? AND company_id = ?`,
            [name, companyId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                message: "Vendor already exists"
            });
        }

        // Insert vendor with company_id
        await db.promise().query(
            `INSERT INTO vendors (name, phone, address, company_id) 
                                                                                                                                                                                                                                                                                                                  VALUES (?, ?, ?, ?)`,
            [name.trim(), phone || null, address || null, companyId]
        );

        res.json({ message: "Vendor added successfully" });

    } catch (error) {
        console.error("ADD VENDOR ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});


/* ================= GET VENDORS ================= */
router.get('/vendors', verifyToken, async (req, res) => {

    try {

        const companyId = req.user.company_id;

        const [vendors] = await db.promise().query(
            `SELECT id, name, phone, address
                                                                                                                                                                                                                                                                                                                                                                                                                   FROM vendors
                                                                                                                                                                                                                                                                                                                                                                                                                                WHERE company_id = ?
                                                                                                                                                                                                                                                                                                                                                                                                                                             ORDER BY name ASC`,
            [companyId]
        );

        res.json(vendors);

    } catch (error) {
        console.error("GET VENDORS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;