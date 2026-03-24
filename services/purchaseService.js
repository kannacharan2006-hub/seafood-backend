const db = require('../config/db');
const { wsManager } = require('../config/websocket');

class PurchaseService {
  static async createPurchase(userId, companyId, vendor_id, supplier_type, date, items) {
    const connection = await db.promise().getConnection();
    
    try {
      await connection.beginTransaction();

      // Validate vendor
      const [vendorCheck] = await connection.query(
        `SELECT id FROM vendors WHERE id = ? AND company_id = ?`,
        [vendor_id, companyId]
      );

      if (vendorCheck.length === 0) {
        throw new Error("Vendor not found");
      }

      // Insert purchase header
      const [purchaseResult] = await connection.query(
        `INSERT INTO purchases (vendor_id, supplier_type, date, created_by, company_id, total_amount) VALUES (?, ?, ?, ?, ?, 0)`,
        [vendor_id, supplier_type || null, date, userId, companyId]
      );

      const purchaseId = purchaseResult.insertId;
      let grandTotal = 0;

      // Insert items + Update raw stock
      for (const item of items) {
        const variant_id = Number(item.variant_id);
        const quantity = parseFloat(item.quantity);
        const price = parseFloat(item.price_per_kg);

        if (!variant_id || quantity <= 0 || price <= 0) {
          throw new Error("Invalid item data");
        }

        const total = Number((quantity * price).toFixed(2));
        grandTotal += total;

        await connection.query(
          `INSERT INTO purchase_items (purchase_id, variant_id, quantity, price_per_kg, total, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, variant_id, quantity, price, total, companyId]
        );

        await connection.query(
          `INSERT INTO raw_stock (variant_id, available_qty, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_qty = available_qty + VALUES(available_qty)`,
          [variant_id, quantity, companyId]
        );
      }

      // Update purchase total
      await connection.query(
        `UPDATE purchases SET total_amount = ? WHERE id = ?`,
        [grandTotal, purchaseId]
      );

      await connection.commit();
      
      wsManager.notifyPurchase(companyId, {
        purchaseId,
        vendor_id,
        total: grandTotal,
        itemCount: items.length
      });
      
      wsManager.notifyStockUpdate(companyId, 'raw_stock', { action: 'purchase', purchaseId });
      
      return { message: "Purchase saved successfully" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deletePurchase(purchaseId, companyId) {
    const connection = await db.promise().getConnection();
    
    try {
      await connection.beginTransaction();

      // Verify purchase
      const [purchaseCheck] = await connection.query(
        `SELECT id FROM purchases WHERE id = ? AND company_id = ?`,
        [purchaseId, companyId]
      );

      if (purchaseCheck.length === 0) {
        throw new Error("Purchase not found");
      }

      // Get purchase items
      const [items] = await connection.query(
        `SELECT variant_id, quantity FROM purchase_items WHERE purchase_id = ? AND company_id = ?`,
        [purchaseId, companyId]
      );

      // Reverse raw stock
      for (const item of items) {
        const qty = parseFloat(item.quantity);

        const [updateResult] = await connection.query(
          `UPDATE raw_stock SET available_qty = available_qty - ? WHERE variant_id = ? AND company_id = ? AND available_qty >= ?`,
          [qty, item.variant_id, companyId, qty]
        );

        if (updateResult.affectedRows === 0) {
          throw new Error("Cannot delete. Raw stock already consumed.");
        }
      }

      // Delete items
      await connection.query(
        `DELETE FROM purchase_items WHERE purchase_id = ? AND company_id = ?`,
        [purchaseId, companyId]
      );

      // Delete purchase
      await connection.query(
        `DELETE FROM purchases WHERE id = ? AND company_id = ?`,
        [purchaseId, companyId]
      );

      await connection.commit();
      
      wsManager.notifyStockUpdate(companyId, 'raw_stock', { action: 'purchase_deleted', purchaseId });
      
      return { message: "Purchase deleted safely" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = PurchaseService;
