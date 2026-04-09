const os = require('os');
const db = require('../config/db');
const logger = require('../config/logger');

class HealthService {
  async checkDatabase() {
    try {
      await db.promise().query('SELECT 1');
      return { status: 'healthy', latency: 0 };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total * 100);
    }, 0) / cpus.length;

    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        cores: cpus.length,
        model: cpus[0].model
      },
      memory: {
        total: this.formatBytes(totalMem),
        used: this.formatBytes(usedMem),
        free: this.formatBytes(freeMem),
        usagePercent: Math.round((usedMem / totalMem) * 10000) / 100
      },
      platform: {
        type: os.type(),
        hostname: os.hostname(),
        uptime: this.formatUptime(os.uptime())
      }
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async getFullHealth() {
    const dbHealth = await this.checkDatabase();
    const metrics = await this.getSystemMetrics();
    
    const isHealthy = dbHealth.status === 'healthy';
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: metrics.platform.uptime,
      database: dbHealth,
      system: metrics,
      checks: {
        database: dbHealth.status === 'healthy' ? 'pass' : 'fail',
        memory: metrics.memory.usagePercent < 90 ? 'pass' : 'warn',
        cpu: metrics.cpu.usage < 90 ? 'pass' : 'warn'
      }
    };
  }

  async getReadiness() {
    const dbHealth = await this.checkDatabase();
    
    return {
      ready: dbHealth.status === 'healthy',
      checks: {
        database: dbHealth.status === 'healthy'
      }
    };
  }
}

module.exports = new HealthService();