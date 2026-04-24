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

  static async updateVendor(vendorId, companyId, name, phone, address) {
    const [result] = await db.promise().query(
      `UPDATE vendors SET name = ?, phone = ?, address = ? WHERE id = ? AND company_id = ?`,
      [name.trim(), phone || null, address || null, vendorId, companyId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Vendor not found");
    }

    return { message: "Vendor updated successfully" };
  }

  static async deleteVendor(vendorId, companyId) {
    const [result] = await db.promise().query(
      `DELETE FROM vendors WHERE id = ? AND company_id = ?`,
      [vendorId, companyId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Vendor not found");
    }

    return { message: "Vendor deleted successfully" };
  }
}

module.exports = VendorService;
