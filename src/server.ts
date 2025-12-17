import express from 'express'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { join } from 'path'
import { readFileSync, realpathSync } from 'fs'
import { createApiRouter } from './api/index.js'
import path from 'path'
import open from 'open'
interface ServerOptions {
  port?: number
  storageFolder?: string
  autoOpenInBrowser?: boolean
}

// use process.args to determine the source directory
// resolve symlinks on process.arv[1] first
const START_SCRIPT = realpathSync(process.argv[1])
const PACKAGE_ROOT = path.join(START_SCRIPT, '..')

const loadOpenApiSpec = () => {
  const openApiSpec = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'openapi.json'), 'utf8'))
  openApiSpec.servers = [{ url: '/api', description: 'Local API server' }]
  return openApiSpec
}

export const startServer = async ({
  port = process.env.PORT != null ? parseInt(process.env.PORT) : 3001,
  storageFolder = process.env.STORAGE_FOLDER || join(process.cwd(), '.mxp'),
  autoOpenInBrowser = false
}: ServerOptions = {}) => {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(cookieParser())

  // Middleware to handle storage folder from query parameter or cookie
  app.use((req, res, next) => {
    const storageFolderParam = req.query.storageFolder as string | undefined
    if (storageFolderParam) {
      // Store in cookie for subsequent requests
      res.cookie('mxp_storage_folder', storageFolderParam, { maxAge: 365 * 24 * 60 * 60 * 1000 })
      // Store in request for use in API routes
      req.storageFolder = storageFolderParam
    } else if (req.cookies?.mxp_storage_folder) {
      // Use cookie if no query param
      req.storageFolder = req.cookies.mxp_storage_folder
    } else {
      // Use default
      req.storageFolder = storageFolder
    }
    next()
  })

  // Serve images from the current storage folder (determined by middleware)
  app.use('/images', (req, res, next) => {
    const currentStorageFolder = req.storageFolder || storageFolder
    express.static(join(currentStorageFolder, 'images'))(req, res, next)
  })

  app.use('/api', await createApiRouter({ storageFolder }))

  // Serve Swagger UI at /api-docs to match OpenAPI spec server URL
  const openApiSpec = loadOpenApiSpec()

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

  // Always serve Vite static assets from the 'dist' folder
  const dist = path.join(PACKAGE_ROOT, 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))

  const server = app.listen(port, () => {
    const actualPort = (server.address() as { port: number }).port
    console.log(`Server running at http://localhost:${actualPort}`)
    console.log(`API documentation available at http://localhost:${actualPort}/api-docs`)
    console.log(`Using storage folder: ${storageFolder}`)
    if (autoOpenInBrowser) {
      open(`http://localhost:${actualPort}`)
    }
  })

  return { app, server }
}
