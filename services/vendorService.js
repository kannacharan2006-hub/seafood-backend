const db = require('../config/db');

class VendorService {
  static async createVendor(companyId, name, phone, address) {
    const [existing] = await db.promise().query(
      `SELECT id FROM vendors WHERE name = ? AND company_id = ?`,
      [name, companyId]
    );

    if (existing.length > 0) {
      throw new Error("Vendor already exists");
    }

    await db.promise().query(
      `INSERT INTO vendors (name, phone, address, company_id) VALUES (?, ?, ?, ?)`,
      [name.trim(), phone || null, address || null, companyId]
    );

    return { message: "Vendor added successfully" };
  }

  static async getVendors(companyId) {
    const [vendors] = await db.promise().query(
      `SELECT id, name, phone, address FROM vendors WHERE company_id = ? ORDER BY name ASC`,
      [companyId]
    );
    return vendors;
  }
}

module.exports = VendorService;
