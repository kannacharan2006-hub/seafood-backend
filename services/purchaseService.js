const Database = require('../config/database');
const { wsManager } = require('../config/websocket');

class PurchaseService {
    static async createPurchase(userId, companyId, vendor_id, supplier_type, date, items, payment_mode = 'NONE', payment_phone = null) {
      const connection = await Database.beginTransaction();
      
      try {
        // Validate vendor
        const vendorCheck = await Database.execute(
          `SELECT id FROM vendors WHERE id = ? AND company_id = ?`,
          [vendor_id, companyId]
        );

        if (vendorCheck.length === 0) {
          throw new Error("Vendor not found");
        }

        // Insert purchase header
        const purchaseResult = await Database.execute(
          `INSERT INTO purchases (vendor_id, supplier_type, date, created_by, company_id, total_amount, payment_mode, payment_phone, payment_status) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'PENDING')`,
          [vendor_id, supplier_type || null, date, userId, companyId, payment_mode, payment_phone]
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

          await Database.execute(
            `INSERT INTO purchase_items (purchase_id, variant_id, quantity, price_per_kg, total, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [purchaseId, variant_id, quantity, price, total, companyId]
          );

          await Database.execute(
            `INSERT INTO raw_stock (variant_id, available_qty, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_qty = available_qty + VALUES(available_qty)`,
            [variant_id, quantity, companyId]
          );
        }

        // Update purchase total
        await Database.execute(
          `UPDATE purchases SET total_amount = ? WHERE id = ?`,
          [grandTotal, purchaseId]
        );

        await Database.commit(connection);
        
        wsManager.notifyPurchase(companyId, {
          purchaseId,
          vendor_id,
          total: grandTotal,
          itemCount: items.length
        });
        
        wsManager.notifyStockUpdate(companyId, 'raw_stock', { action: 'purchase', purchaseId });
        
        return { message: "Purchase saved successfully" };
      } catch (error) {
        await Database.rollback(connection);
        throw error;
      }
    }

    static async deletePurchase(purchaseId, companyId) {
      const connection = await Database.beginTransaction();
      
      try {
        // Verify purchase
        const purchaseCheck = await Database.execute(
          `SELECT id FROM purchases WHERE id = ? AND company_id = ?`,
          [purchaseId, companyId]
        );

        if (purchaseCheck.length === 0) {
          throw new Error("Purchase not found");
        }

        // Get purchase items
        const items = await Database.execute(
          `SELECT variant_id, quantity FROM purchase_items WHERE purchase_id = ? AND company_id = ?`,
          [purchaseId, companyId]
        );

        // Reverse raw stock
        for (const item of items) {
          const qty = parseFloat(item.quantity);

          const updateResult = await Database.execute(
            `UPDATE raw_stock SET available_qty = available_qty - ? WHERE variant_id = ? AND company_id = ? AND available_qty >= ?`,
            [qty, item.variant_id, companyId, qty]
          );

          if (updateResult.affectedRows === 0) {
            throw new Error("Cannot delete. Raw stock already consumed.");
          }
        }

        // Delete items
        await Database.execute(
          `DELETE FROM purchase_items WHERE purchase_id = ? AND company_id = ?`,
          [purchaseId, companyId]
        );

        // Delete purchase
        await Database.execute(
          `DELETE FROM purchases WHERE id = ? AND company_id = ?`,
          [purchaseId, companyId]
        );

        await Database.commit(connection);
        
        wsManager.notifyStockUpdate(companyId, 'raw_stock', { action: 'purchase_deleted', purchaseId });
        
        return { message: "Purchase deleted safely" };
      } catch (error) {
        await Database.rollback(connection);
        throw error;
      }
    }

    static async getInvoiceData(purchaseId, companyId) {
      const purchase = await Database.getOne(
        `SELECT p.*, v.name AS vendor_name, v.phone AS vendor_phone, v.address AS vendor_address 
         FROM purchases p 
         JOIN vendors v ON p.vendor_id = v.id 
         WHERE p.id = ? AND p.company_id = ?`,
        [purchaseId, companyId]
      );

      if (!purchase) {
        throw new Error("Purchase not found");
      }

      const items = await Database.getAll(
        `SELECT pi.*, i.name AS item_name, var.variant_name 
         FROM purchase_items pi 
         JOIN variants var ON pi.variant_id = var.id 
         JOIN items i ON var.item_id = i.id 
         WHERE pi.purchase_id = ? AND pi.company_id = ?`,
        [purchaseId, companyId]
      );

      const company = await Database.getOne(
        `SELECT name, phone, email FROM companies WHERE id = ?`,
        [companyId]
      );

      const vendor = {
        name: purchase.vendor_name,
        phone: purchase.vendor_phone,
        address: purchase.vendor_address
      };

      const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

      return { items, company, vendor, grandTotal, purchaseDate: purchase.date };
    }

    static async updatePayment(purchaseId, companyId, payment_status, payment_mode, payment_phone, payment_reference, payment_notes) {
      const purchaseCheck = await Database.execute(
        `SELECT id FROM purchases WHERE id = ? AND company_id = ?`,
        [purchaseId, companyId]
      );

      if (purchaseCheck.length === 0) {
        throw new Error("Purchase not found");
      }

      const updateFields = [];
      const updateValues = [];

      if (payment_status) {
        updateFields.push('payment_status = ?');
        updateValues.push(payment_status);
        if (payment_status === 'PAID') {
          updateFields.push('payment_date = CURDATE()');
        }
      }
      if (payment_mode) {
        updateFields.push('payment_mode = ?');
        updateValues.push(payment_mode);
      }
      if (payment_phone !== undefined) {
        updateFields.push('payment_phone = ?');
        updateValues.push(payment_phone);
      }
      if (payment_reference) {
        updateFields.push('payment_reference = ?');
        updateValues.push(payment_reference);
      }
      if (payment_notes) {
        updateFields.push('payment_notes = ?');
        updateValues.push(payment_notes);
      }

      updateValues.push(purchaseId, companyId);

      await Database.execute(
        `UPDATE purchases SET ${updateFields.join(', ')} WHERE id = ? AND company_id = ?`,
        updateValues
      );

      return { message: "Payment updated successfully" };
    }
}

module.exports = PurchaseService;
