// Admin Module - Export all admin functionality

export * from './types/index.js';
export * from './middleware/admin-auth.middleware.js';
export * from './services/index.js';
export { adminRoutes } from './routes/index.js';
export {
  setupAdminWebSocket,
  broadcastToAdmins,
  broadcastJobUpdate,
  broadcastUserActivity,
  broadcastAlert,
  getConnectedClientsCount,
  getConnectedClientsInfo,
} from './websocket/metrics.handler.js';
