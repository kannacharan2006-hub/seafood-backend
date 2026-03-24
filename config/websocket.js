const WebSocket = require('ws');
const logger = require('./logger');
const jwt = require('jsonwebtoken');

class WebSocketManager {
  constructor() {
    this.clients = new Map();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const clientId = Date.now() + Math.random();
      
      ws.isAlive = true;
      ws.clientId = clientId;
      ws.companyId = null;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (err) {
          logger.error('WebSocket message parse error:', err);
        }
      });

      ws.on('close', () => {
        if (ws.companyId) {
          const companyClients = this.clients.get(ws.companyId);
          if (companyClients) {
            companyClients.delete(clientId);
            if (companyClients.size === 0) {
              this.clients.delete(ws.companyId);
            }
          }
        }
        logger.info(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (err) => {
        logger.error(`WebSocket error for client ${clientId}:`, err);
      });

      logger.info(`New WebSocket client connected: ${clientId}`);
    });

    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });

    logger.info('WebSocket server initialized on /ws');
    return this;
  }

  handleMessage(ws, message) {
    if (message.type === 'auth') {
      const { companyId, token } = message;
      
      if (!companyId || !token) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid auth data' }));
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.company_id !== parseInt(companyId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Company mismatch' }));
          return;
        }

        ws.companyId = parseInt(companyId);
        
        if (!this.clients.has(ws.companyId)) {
          this.clients.set(ws.companyId, new Set());
        }
        this.clients.get(ws.companyId).add(ws);

        ws.send(JSON.stringify({ 
          type: 'auth_success', 
          message: 'Authenticated successfully' 
        }));

        logger.info(`Client ${ws.clientId} authenticated for company ${ws.companyId}`);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
      }
    }
  }

  notifyStockUpdate(companyId, stockType, data) {
    const message = JSON.stringify({
      type: 'stock_update',
      stockType,
      data,
      timestamp: new Date().toISOString()
    });

    const clients = this.clients.get(parseInt(companyId));
    if (clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
      logger.info(`Stock update sent to company ${companyId}: ${stockType}`);
    }
  }

  notifyPurchase(companyId, purchaseData) {
    const message = JSON.stringify({
      type: 'purchase_created',
      data: purchaseData,
      timestamp: new Date().toISOString()
    });

    const clients = this.clients.get(parseInt(companyId));
    if (clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  notifyExport(companyId, exportData) {
    const message = JSON.stringify({
      type: 'export_created',
      data: exportData,
      timestamp: new Date().toISOString()
    });

    const clients = this.clients.get(parseInt(companyId));
    if (clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  notifyConversion(companyId, conversionData) {
    const message = JSON.stringify({
      type: 'conversion_created',
      data: conversionData,
      timestamp: new Date().toISOString()
    });

    const clients = this.clients.get(parseInt(companyId));
    if (clients) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

const wsManager = new WebSocketManager();

module.exports = { wsManager, WebSocketManager };
