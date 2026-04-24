const db = require('../config/db');

class PaymentService {
  static async recordCustomerPayment(companyId, customer_id, amount) {
    const [customer] = await db.promise().query(
      `SELECT id FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );

    if (customer.length === 0) {
      throw new Error("Customer not found");
    }

    await db.promise().query(`
      INSERT INTO customer_payments (customer_id, amount, date, company_id)
      VALUES (?, ?, CURDATE(), ?)
    `, [customer_id, amount, companyId]);

    return { message: "Customer payment recorded successfully" };
  }

  static async recordVendorPayment(companyId, vendor_id, amount) {
    const [vendor] = await db.promise().query(
      `SELECT id FROM vendors WHERE id = ? AND company_id = ?`,
      [vendor_id, companyId]
    );

    if (vendor.length === 0) {
      throw new Error("Vendor not found");
    }

    await db.promise().query(`
      INSERT INTO vendor_payments (vendor_id, amount, date, company_id)
      VALUES (?, ?, CURDATE(), ?)
    `, [vendor_id, amount, companyId]);

    return { message: "Vendor payment recorded successfully" };
  }

  static async getCustomerBalance(companyId, customerId) {
    const [result] = await db.promise().query(`
      SELECT c.name,
        IFNULL(SUM(ei.total),0) AS total_sales,
        IFNULL((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.customer_id = c.id AND cp.company_id = ?),0) AS total_paid
      FROM customers c
      LEFT JOIN exports e ON e.customer_id = c.id AND e.company_id = ?
      LEFT JOIN export_items ei ON ei.export_id = e.id
      WHERE c.id = ? AND c.company_id = ?
      GROUP BY c.id
    `, [companyId, companyId, customerId, companyId]);

    if (!result.length) {
      throw new Error("Customer not found");
    }

    const data = result[0];
    return {
      customer_id: customerId,
      customer_name: data.name,
      totalSales: Number(data.total_sales),
      totalPaid: Number(data.total_paid),
      balance: Number(data.total_sales) - Number(data.total_paid)
    };
  }

  static async getVendorBalance(companyId, vendorId) {
    const [result] = await db.promise().query(`
      SELECT v.name, v.phone,
        IFNULL(SUM(pi.total),0) AS total_purchase,
        IFNULL((SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.vendor_id = v.id AND vp.company_id = ?),0) AS total_paid
      FROM vendors v
      LEFT JOIN purchases p ON p.vendor_id = v.id AND p.company_id = ?
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      WHERE v.id = ? AND v.company_id = ?
      GROUP BY v.id
    `, [companyId, companyId, vendorId, companyId]);

    if (!result.length) {
      throw new Error("Vendor not found");
    }

    const data = result[0];
    return {
      vendor_id: vendorId,
      vendor_name: data.name,
      vendor_phone: data.phone || '',
      totalPurchase: Number(data.total_purchase),
      totalPaid: Number(data.total_paid),
      balance: Number(data.total_purchase) - Number(data.total_paid)
    };
  }

  static async getCustomerPaymentHistory(companyId, customerId) {
    const [rows] = await db.promise().query(`
      SELECT amount, date FROM customer_payments
      WHERE customer_id = ? AND company_id = ?
      ORDER BY date DESC
    `, [customerId, companyId]);
    return rows;
  }

  static async getVendorPaymentHistory(companyId, vendorId) {
    const [rows] = await db.promise().query(`
      SELECT amount, date FROM vendor_payments
      WHERE vendor_id = ? AND company_id = ?
      ORDER BY date DESC
    `, [vendorId, companyId]);
    return rows;
  }
}

module.exports = PaymentService;
