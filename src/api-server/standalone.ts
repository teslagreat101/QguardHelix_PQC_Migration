import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiServer } from './index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const distDir = path.join(projectRoot, 'dist')
const port = Number(process.env.PORT || process.env.API_PORT || 3000)

const app = express()
const api = createApiServer()

app.use(api)
app.use(express.static(distDir, { index: false, maxAge: '1h' }))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
  console.log(`QGuard Helix server listening on http://localhost:${port}`)
})
