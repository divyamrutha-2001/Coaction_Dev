import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend')
const apiPort = Number(process.env.API_PORT || 8787)
const port = Number(process.env.PREVIEW_PORT || 5173)
const app = express()

app.use('/api', (req, res) => {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: apiPort,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode || 502, apiRes.headers)
      apiRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).json({ message: 'API proxy failed.' })
  })
  req.pipe(upstream)
})

app.use(express.static(root))
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  res.sendFile(path.join(root, 'index.html'))
})

app.listen(port, () => {
  console.log(`Workbench preview http://localhost:${port}`)
  console.log(`Proxying /api to http://127.0.0.1:${apiPort}`)
})
