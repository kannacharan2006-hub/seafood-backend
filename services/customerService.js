const db = require('../config/db');

class CustomerService {
  static async createCustomer(companyId, name, phone, address) {
    const [existing] = await db.promise().query(
      `SELECT id FROM customers WHERE name = ? AND company_id = ?`,
      [name, companyId]
    );

    if (existing.length > 0) {
      throw new Error("Customer already exists");
    }

    await db.promise().query(
      `INSERT INTO customers (name, phone, address, company_id) VALUES (?, ?, ?, ?)`,
      [name.trim(), phone || null, address || null, companyId]
    );

    return { message: "Customer added successfully" };
  }

  static async getCustomers(companyId) {
    const [customers] = await db.promise().query(
      `SELECT id, name, phone, address FROM customers WHERE company_id = ? ORDER BY name ASC`,
      [companyId]
    );
    return customers;
  }
}

module.exports = CustomerService;
