import express from 'express'
import dashboardRoutes from './dashboard'

/**
 * QGuard Helix — Express API Server
 * Mounted under /api/v1 in development via Vite configureServer.
 * In production, this can be run as a standalone server or mounted under an API gateway.
 */
export function createApiServer() {
  const app = express()

  app.use(express.json())

  // CORS for development
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } })
  })

  return app
}

export default createApiServer
