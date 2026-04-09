const express = require('express');
const router = express.Router();
const healthService = require('../services/healthService');
const backupService = require('../services/backupService');
const requestLogger = require('../services/requestLogger');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns a simple health status
 *     responses:
 *       200:
 *         description: Server is running
 */
router.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

/**
 * @swagger
 * /health/full:
 *   get:
 *     summary: Full health check with system metrics
 *     description: Returns detailed health status including database and system metrics
 *     responses:
 *       200:
 *         description: Full health status
 */
router.get('/full', async (req, res) => {
  try {
    const health = await healthService.getFullHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Used by Kubernetes/lb to check if app is ready to receive traffic
 *     responses:
 *       200:
 *         description: App is ready
 *       503:
 *         description: App is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    const readiness = await healthService.getReadiness();
    
    if (readiness.ready) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ 
        status: 'not ready',
        checks: readiness.checks 
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error.message 
    });
  }
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Used by Kubernetes to check if app is alive
 *     responses:
 *       200:
 *         description: App is alive
 */
router.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});

/**
 * @swagger
 * /health/backup:
 *   get:
 *     summary: Get backup status and history
 *     description: Returns list of available backups
 *     responses:
 *       200:
 *         description: Backup list
 */
router.get('/backup', async (req, res) => {
  try {
    const backups = backupService.getBackupList();
    res.json({
      success: true,
      backups: backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /health/backup:
 *   post:
 *     summary: Trigger manual backup
 *     description: Creates a manual database backup
 *     responses:
 *       200:
 *         description: Backup created
 *       500:
 *         description: Backup failed
 */
router.post('/backup', async (req, res) => {
  try {
    const backup = await backupService.createBackup();
    res.json({
      success: true,
      message: 'Backup created successfully',
      backup: backup
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Backup failed',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/stats:
 *   get:
 *     summary: Get request statistics
 *     description: Returns request statistics from log files
 *     responses:
 *       200:
 *         description: Request stats
 */
router.get('/stats', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 1;
    const requestStats = requestLogger.getRequestStats(days);
    const errorStats = requestLogger.getErrorStats(days);
    
    res.json({
      success: true,
      requests: requestStats,
      errors: errorStats.slice(0, 50) // Limit to 50 recent errors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;