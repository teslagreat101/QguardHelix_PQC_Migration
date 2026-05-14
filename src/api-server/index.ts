import express from 'express'
import dashboardRoutes from './dashboard'
import profileRoutes from './profile'
import scannerRoutes from './scanner'
import agentScannerRoutes, { startAgentScannerScheduler } from './agent-scanner'
import serviceRecordRoutes from './service-records'

/**
 * QGuard Helix — Express API Server
 * Mounted under /api/v1 in development via Vite configureServer.
 * In production, this can be run as a standalone server or mounted under an API gateway.
 */
export function createApiServer() {
  const app = express()

  app.use(express.json({ limit: '8mb' }))

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  // CORS for development
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-QGuard-Device-Id, X-QGuard-Refresh-Token, X-QGuard-Agent-Id, X-QGuard-Agent-Token')
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
          scanner: 'operational',
          pqcEngine: 'operational',
          qrng: 'operational',
          vault: 'operational',
          monitoring: 'operational',
        },
        pqcAlgorithms: ['ML-KEM (Kyber)', 'ML-DSA (Dilithium)', 'SPHINCS+', 'HYBRID'],
      },
    })
  })

  // Dashboard API routes
  app.use('/api/v1/dashboard', dashboardRoutes)
  app.use('/api/v1/profile', profileRoutes)
  app.use('/api/v1/scanner', scannerRoutes)
  app.use('/api/v1/agent-scanner', agentScannerRoutes)
  app.use('/api/v1', serviceRecordRoutes)

  startAgentScannerScheduler()

  // API-only 404 handler. In standalone mode non-API routes fall through to Vite static files.
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      next()
      return
    }
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } })
  })

  return app
}

export default createApiServer
