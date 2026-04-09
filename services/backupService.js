const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../config/logger');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      logger.info(`Backup directory created: ${this.backupDir}`);
    }
  }

  generateBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `seafood_erp_backup_${timestamp}`;
  }

  async createBackup() {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'seafood_erp'
    };

    const filename = this.generateBackupFilename();
    const filepath = path.join(this.backupDir, `${filename}.sql`);
    const gzFilepath = `${filepath}.gz`;

    const mysqldumpCmd = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user}${dbConfig.password ? ` -p${dbConfig.password}` : ''} ${dbConfig.database}`;

    return new Promise((resolve, reject) => {
      const dumpProcess = exec(`${mysqldumpCmd} | gzip > ${gzFilepath}`, (error, stdout, stderr) => {
        if (error) {
          logger.error('Backup failed:', error);
          reject(error);
          return;
        }

        const stats = fs.statSync(gzFilepath);
        const backupInfo = {
          filename: `${filename}.sql.gz`,
          filepath: gzFilepath,
          size: stats.size,
          createdAt: new Date().toISOString()
        };

        logger.info(`Backup created successfully: ${filename}.sql.gz (${this.formatBytes(stats.size)})`);
        
        this.cleanupOldBackups();
        
        resolve(backupInfo);
      });
    });
  }

  cleanupOldBackups() {
    const maxBackups = parseInt(process.env.MAX_BACKUPS) || 7;
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;

    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.sql.gz'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      const now = Date.now();
      const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);

      // Keep only maxBackups most recent
      if (files.length > maxBackups) {
        files.slice(maxBackups).forEach(file => {
          fs.unlinkSync(file.path);
          logger.info(`Old backup deleted: ${file.name}`);
        });
      }

      // Delete files older than retention days
      files.forEach(file => {
        if (file.time < cutoffTime) {
          fs.unlinkSync(file.path);
          logger.info(`Expired backup deleted: ${file.name}`);
        }
      });
    } catch (error) {
      logger.error('Error cleaning up old backups:', error);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getBackupList() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.sql.gz'))
        .map(file => {
          const stats = fs.statSync(path.join(this.backupDir, file));
          return {
            filename: file,
            size: this.formatBytes(stats.size),
            createdAt: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return files;
    } catch (error) {
      logger.error('Error getting backup list:', error);
      return [];
    }
  }

  startScheduledBackups() {
    const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Default: 2 AM daily
    
    if (cron.validate(schedule)) {
      cron.schedule(schedule, async () => {
        logger.info('Starting scheduled database backup...');
        try {
          await this.createBackup();
          logger.info('Scheduled backup completed successfully');
        } catch (error) {
          logger.error('Scheduled backup failed:', error);
        }
      });
      logger.info(`Backup scheduler started with schedule: ${schedule}`);
    } else {
      logger.warn('Invalid backup schedule, skipping scheduler');
    }
  }
}

module.exports = new BackupService();