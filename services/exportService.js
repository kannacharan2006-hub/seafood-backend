const db = require('../config/db');
const { wsManager } = require('../config/websocket');

class ExportService {
  static async createExport(userId, companyId, customer_id, date, items) {
    const connection = await db.promise().getConnection();
    
    try {
      await connection.beginTransaction();

      // Validate customer
      const [customerCheck] = await connection.query(
        `SELECT id FROM customers WHERE id=? AND company_id=?`,
        [customer_id, companyId]
      );

      if (!customerCheck.length) throw new Error("Customer not found");

       // Get next invoice number using a sequence-like approach
       const [invoiceResult] = await connection.query(
         `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, 4) AS UNSIGNED)), 0) + 1 as next_id 
          FROM exports 
          WHERE invoice_no LIKE 'INV%'`
       );
       const invoice_no = "INV" + invoiceResult[0].next_id.toString().padStart(6, '0');

      // Insert export
      const [exportResult] = await connection.query(
        `INSERT INTO exports (customer_id, invoice_no, date, created_by, company_id) VALUES (?,?,?,?,?)`,
        [customer_id, invoice_no, date, userId, companyId]
      );

      const exportId = exportResult.insertId;

      // Process items
      for (const item of items) {
        const variant_id = Number(item.variant_id);
        const quantity = parseFloat(item.quantity);
        const price = parseFloat(item.price_per_kg);

        if (!variant_id || quantity <= 0 || price <= 0) {
          throw new Error("Invalid item data");
        }

        const total = Number((quantity * price).toFixed(2));

        // Deduct stock
        const [updateResult] = await connection.query(
          `UPDATE final_stock SET available_qty = available_qty - ? WHERE variant_id = ? AND company_id = ? AND available_qty >= ?`,
          [quantity, variant_id, companyId, quantity]
        );

        if (!updateResult.affectedRows) {
          throw new Error("Insufficient stock");
        }

        // Insert export item
        await connection.query(
          `INSERT INTO export_items (export_id, variant_id, quantity, price_per_kg, total, company_id) VALUES (?,?,?,?,?,?)`,
          [exportId, variant_id, quantity, price, total, companyId]
        );
      }

      await connection.commit();
      
      wsManager.notifyExport(companyId, {
        exportId,
        invoice_no,
        customer_id,
        itemCount: items.length
      });
      
      wsManager.notifyStockUpdate(companyId, 'final_stock', { action: 'export', exportId });
      
      return { message: "Export successful", invoice_no };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteExport(exportId, companyId) {
    const connection = await db.promise().getConnection();
    
    try {
      await connection.beginTransaction();

      // Verify export
      const [exportCheck] = await connection.query(
        `SELECT id FROM exports WHERE id=? AND company_id=?`,
        [exportId, companyId]
      );

      if (!exportCheck.length) throw new Error("Export not found");

      // Get items
      const [items] = await connection.query(
        `SELECT variant_id, quantity FROM export_items WHERE export_id=? AND company_id=?`,
        [exportId, companyId]
      );

      // Restore stock
      for (const item of items) {
        await connection.query(
          `INSERT INTO final_stock (variant_id, available_qty, company_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE available_qty = available_qty + VALUES(available_qty)`,
          [item.variant_id, item.quantity, companyId]
        );
      }

      // Delete items
      await connection.query(
        `DELETE FROM export_items WHERE export_id=? AND company_id=?`,
        [exportId, companyId]
      );

      // Delete export
      await connection.query(
        `DELETE FROM exports WHERE id=? AND company_id=?`,
        [exportId, companyId]
      );

      await connection.commit();
      
      wsManager.notifyStockUpdate(companyId, 'final_stock', { action: 'export_deleted', exportId });
      
      return { message: "Export deleted & stock restored" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getExports(companyId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [totalResult] = await db.promise().query(
      `SELECT COUNT(*) as total FROM exports WHERE company_id = ?`,
      [companyId]
    );
    const totalItems = totalResult[0].total;

    const [exports] = await db.promise().query(`
      SELECT e.id, e.invoice_no, e.date, e.created_at, c.name AS customer_name, u.name AS created_by
      FROM exports e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.company_id = ?
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?
    `, [companyId, limit, offset]);

    if (exports.length === 0) {
      const totalPages = Math.ceil(totalItems / limit);
      return {
        data: [],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    }

    const exportIds = exports.map(exp => exp.id);

    const [allItems] = await db.promise().query(`
      SELECT ei.export_id, i.name AS item_name, v.variant_name, ei.quantity, ei.price_per_kg, ei.total
      FROM export_items ei
      JOIN variants v ON ei.variant_id = v.id
      JOIN items i ON v.item_id = i.id
      WHERE ei.export_id IN (?) AND ei.company_id = ?
    `, [exportIds, companyId]);

    const itemsByExportId = {};
    for (const item of allItems) {
      if (!itemsByExportId[item.export_id]) {
        itemsByExportId[item.export_id] = [];
      }
      itemsByExportId[item.export_id].push(item);
    }

    for (let exp of exports) {
      exp.items = itemsByExportId[exp.id] || [];
    }

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: exports,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  static async getInvoiceData(exportId, companyId) {
    const [items] = await db.promise().query(`
      SELECT e.invoice_no, e.date, e.created_at, c.name AS customer_name, c.address AS customer_address, 
             c.phone AS customer_phone, i.name AS item_name, v.variant_name, 
             ei.quantity, ei.price_per_kg, ei.total
      FROM exports e JOIN export_items ei ON e.id = ei.export_id
      JOIN variants v ON ei.variant_id = v.id JOIN items i ON v.item_id = i.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.id=? AND e.company_id=?`, [exportId, companyId]);

    if (!items.length) {
      throw new Error("Invoice not found");
    }

    const [companies] = await db.promise().query(
      `SELECT name, phone, email FROM companies WHERE id = ?`, [companyId]
    );

    const safeItems = items.map(item => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      price_per_kg: parseFloat(item.price_per_kg) || 0,
      total: parseFloat(item.total) || 0
    }));

    const subTotal = safeItems.reduce((sum, item) => sum + item.total, 0);

    return {
      items: safeItems,
      company: companies[0] || {},
      subTotal,
      grandTotal: subTotal
    };
  }
}

module.exports = ExportService;
