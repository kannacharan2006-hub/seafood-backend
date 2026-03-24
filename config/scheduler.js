const cron = require('node-cron');
const db = require('../config/db');
const logger = require('./logger');

class SchedulerService {
  static start() {
    logger.info('Starting scheduler service...');

    cron.schedule('0 2 * * *', async () => {
      await this.archiveOldExports();
    }, {
      timezone: 'Asia/Kolkata'
    });

    cron.schedule('0 3 * * *', async () => {
      await this.cleanupOrphanedRecords();
    }, {
      timezone: 'Asia/Kolkata'
    });

    cron.schedule('0 4 * * 0', async () => {
      await this.generateWeeklyReport();
    }, {
      timezone: 'Asia/Kolkata'
    });

    cron.schedule('0 5 1 * *', async () => {
      await this.archiveOldData();
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Scheduler service started successfully');
  }

  static async archiveOldExports() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);

      const [result] = await db.promise().query(
        `INSERT INTO exports_archive 
        (export_id, customer_id, invoice_no, date, created_by, company_id, archived_at)
        SELECT id, customer_id, invoice_no, date, created_by, company_id, NOW()
        FROM exports 
        WHERE date < ? 
        AND id NOT IN (SELECT export_id FROM exports_archive WHERE export_id IS NOT NULL)`,
        [cutoffDate]
      );

      if (result.affectedRows > 0) {
        logger.info(`Archived ${result.affectedRows} old export records`);
      }
    } catch (error) {
      logger.error('Archive old exports error:', error);
    }
  }

  static async cleanupOrphanedRecords() {
    try {
      const [deletedItems] = await db.promise().query(
        `DELETE FROM export_items WHERE export_id NOT IN (SELECT id FROM exports)`
      );

      const [deletedPurchases] = await db.promise().query(
        `DELETE FROM purchase_items WHERE purchase_id NOT IN (SELECT id FROM purchases)`
      );

      const [deletedInputs] = await db.promise().query(
        `DELETE FROM conversion_inputs WHERE conversion_id NOT IN (SELECT id FROM conversion)`
      );

      const [deletedOutputs] = await db.promise().query(
        `DELETE FROM conversion_outputs WHERE conversion_id NOT IN (SELECT id FROM conversion)`
      );

      const total = deletedItems.affectedRows + deletedPurchases.affectedRows + 
                    deletedInputs.affectedRows + deletedOutputs.affectedRows;

      if (total > 0) {
        logger.info(`Cleaned up ${total} orphaned records`);
      }
    } catch (error) {
      logger.error('Cleanup orphaned records error:', error);
    }
  }

  static async generateWeeklyReport() {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [companies] = await db.promise().query(`SELECT id FROM companies`);

      for (const company of companies) {
        const companyId = company.id;

        const [purchaseTotal] = await db.promise().query(
          `SELECT IFNULL(SUM(pi.total), 0) as total 
           FROM purchases p 
           JOIN purchase_items pi ON p.id = pi.purchase_id 
           WHERE p.company_id = ? AND p.date >= ?`,
          [companyId, weekAgo]
        );

        const [salesTotal] = await db.promise().query(
          `SELECT IFNULL(SUM(ei.total), 0) as total 
           FROM exports e 
           JOIN export_items ei ON e.id = ei.export_id 
           WHERE e.company_id = ? AND e.date >= ?`,
          [companyId, weekAgo]
        );

        await db.promise().query(
          `INSERT INTO weekly_reports (company_id, period_start, period_end, total_purchase, total_sales, profit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            companyId, 
            weekAgo, 
            new Date(),
            purchaseTotal[0].total,
            salesTotal[0].total,
            salesTotal[0].total - purchaseTotal[0].total
          ]
        );

        logger.info(`Generated weekly report for company ${companyId}`);
      }
    } catch (error) {
      logger.error('Generate weekly report error:', error);
    }
  }

  static async archiveOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

      const [purchases] = await db.promise().query(
        `SELECT COUNT(*) as count FROM purchases WHERE date < ?`,
        [cutoffDate]
      );

      if (purchases[0].count > 0) {
        await db.promise().query(
          `INSERT INTO purchases_archive 
           (purchase_id, vendor_id, supplier_type, date, total_amount, created_by, company_id, archived_at)
           SELECT id, vendor_id, supplier_type, date, total_amount, created_by, company_id, NOW()
           FROM purchases WHERE date < ?`,
          [cutoffDate]
        );

        await db.promise().query(
          `INSERT INTO purchase_items_archive 
           (archive_purchase_id, variant_id, quantity, price_per_kg, total, company_id)
           SELECT pa.id, pi.variant_id, pi.quantity, pi.price_per_kg, pi.total, pi.company_id
           FROM purchase_items pi
           JOIN purchases_archive pa ON pi.purchase_id = pa.purchase_id
           WHERE pa.archived_at = NOW()`,
          []
        );

        await db.promise().query(
          `DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE date < ?)`,
          [cutoffDate]
        );

        await db.promise().query(
          `DELETE FROM purchases WHERE date < ?`,
          [cutoffDate]
        );

        logger.info(`Archived ${purchases[0].count} old purchase records`);
      }
    } catch (error) {
      logger.error('Archive old data error:', error);
    }
  }
}

module.exports = SchedulerService;
