const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class RequestLogger {
  constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.ensureLogDirectory();
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFilename() {
    const date = new Date().toISOString().slice(0, 10);
    return `requests_${date}.log`;
  }

  getErrorLogFilename() {
    const date = new Date().toISOString().slice(0, 10);
    return `errors_${date}.log`;
  }

  formatLog(entry) {
    return JSON.stringify(entry);
  }

  writeLog(filename, entry) {
    const filepath = path.join(this.logDir, filename);
    const logLine = this.formatLog(entry) + '\n';
    
    fs.appendFile(filepath, logLine, (err) => {
      if (err) {
        logger.error('Failed to write log to file:', err);
      }
    });
  }

  logRequest(req, res, duration) {
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      user: req.user ? req.user.id : null,
      company: req.user ? req.user.company_id : null
    };

    // Log to console
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);

    // Write to file
    if (this.logLevel === 'info' || this.logLevel === 'debug') {
      this.writeLog(this.getLogFilename(), entry);
    }

    return entry;
  }

  logError(req, res, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      ip: req.ip || req.connection.remoteAddress,
      requestId: req.requestId,
      user: req.user ? req.user.id : null,
      company: req.user ? req.user.company_id : null
    };

    // Log to console as error
    logger.error(`${req.method} ${req.url} - ${error.message}`);

    // Write to error log file
    this.writeLog(this.getErrorLogFilename(), entry);

    return entry;
  }

  getRequestStats(days = 1) {
    const stats = {
      totalRequests: 0,
      byMethod: {},
      byStatus: {},
      byEndpoint: {},
      errors: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      responseTimes: []
    };

    try {
      const logFile = path.join(this.logDir, this.getLogFilename());
      
      if (!fs.existsSync(logFile)) {
        return stats;
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          stats.totalRequests++;
          
          stats.byMethod[entry.method] = (stats.byMethod[entry.method] || 0) + 1;
          stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
          
          const endpoint = entry.path || entry.url;
          stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;
          
          if (entry.status >= 400) {
            stats.errors++;
          }
          
          const duration = parseInt(entry.duration);
          if (!isNaN(duration)) {
            stats.responseTimes.push(duration);
          }
        } catch (e) {
          // Skip invalid lines
        }
      });

      // Calculate average and p95 response times
      if (stats.responseTimes.length > 0) {
        const sorted = stats.responseTimes.sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        stats.avgResponseTime = Math.round(sum / sorted.length);
        stats.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
      }

      // Clean up response times array to save memory
      delete stats.responseTimes;

    } catch (error) {
      logger.error('Error reading request stats:', error);
    }

    return stats;
  }

  getErrorStats(days = 1) {
    const errors = [];

    try {
      const errorLogFile = path.join(this.logDir, this.getErrorLogFilename());
      
      if (!fs.existsSync(errorLogFile)) {
        return errors;
      }

      const content = fs.readFileSync(errorLogFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          errors.push({
            timestamp: entry.timestamp,
            method: entry.method,
            url: entry.url,
            status: entry.status,
            error: entry.error?.message
          });
        } catch (e) {
          // Skip invalid lines
        }
      });

    } catch (error) {
      logger.error('Error reading error stats:', error);
    }

    return errors;
  }

  cleanOldLogs(daysToKeep = 30) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    try {
      const files = fs.readdirSync(this.logDir);
      
      files.forEach(file => {
        const filepath = path.join(this.logDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filepath);
          logger.info(`Old log file deleted: ${file}`);
        }
      });
    } catch (error) {
      logger.error('Error cleaning old logs:', error);
    }
  }
}

module.exports = new RequestLogger();