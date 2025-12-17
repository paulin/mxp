import { Router } from 'express'
import { addProjectPath, getRecentProjects } from '../config/UserConfig.js'
import { getFileStore } from './FileStoreCache.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface ApiConfig {
  /** Default storage folder path */
  storageFolder: string
}

export const createApiRouter = async (config: ApiConfig): Promise<Router> => {
  const router = Router()
  
  // Middleware to get the appropriate FileStore based on request
  router.use(async (req, res, next) => {
    const requestStorageFolder = req.storageFolder || config.storageFolder
    req.fileStore = await getFileStore(requestStorageFolder)
    next()
  })

  // Add config endpoint
  router.get('/config', (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      res.json(req.fileStore.config)
    } catch (error) {
      console.error('Error getting config:', error)
      res.status(500).json({ error: 'Failed to get config' })
    }
  })

  // Get all nodes
  router.get('/nodes', async (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      const nodes = req.fileStore.allNodes
      res.json(nodes)
    } catch (error: any) {
      console.error('Unexpected error getting nodes:', error)
      res.status(500).json({ error: 'Failed to get nodes' })
    }
  })

  // Add a new node
  router.post('/nodes', async (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      const { node, parentNodeId, insertAtIndex } = req.body
      const { type, ...properties } = node
      const result = await req.fileStore.createNode(type, properties, parentNodeId, insertAtIndex)
      // Return the exact same object structure as FileStore.createNode
      res.status(201).json(result)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Parent node ${req.body.parentNodeId} not found` })
      } else {
        console.error('Unexpected error creating node:', error)
        res.status(500).json({ error: 'Failed to create node' })
      }
    }
  })

  // Update a node
  router.patch('/nodes/:nodeId', async (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      const delta = await req.fileStore.updateNode(req.params.nodeId, req.body)
      res.json(delta)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else {
        console.error('Unexpected error updating node:', error)
        res.status(500).json({ error: 'Failed to update node' })
      }
    }
  })

  // Delete a node
  router.delete('/nodes/:nodeId', async (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      const delta = await req.fileStore.deleteNode(req.params.nodeId)
      res.json(delta)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else {
        console.error('Unexpected error deleting node:', error)
        res.status(500).json({ error: 'Failed to delete node' })
      }
    }
  })

  // Change a node's parent
  router.put('/nodes/:nodeId/parent', async (req, res) => {
    try {
      if (!req.fileStore) {
        return res.status(500).json({ error: 'FileStore not initialized' })
      }
      const { newParentId, insertAtIndex } = req.body
      const delta = await req.fileStore.setNodeParent(req.params.nodeId, newParentId, insertAtIndex)
      res.status(200).json(delta)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: `Node ${req.params.nodeId} not found` })
      } else if (error.message?.includes('descendants') || error.message?.includes('root node')) {
        res.status(400).json({ error: error.message })
      } else {
        console.error('Unexpected error changing node parent:', error)
        res.status(500).json({ error: 'Failed to change node parent' })
      }
    }
  })

  // Get recent projects
  router.get('/projects', async (req, res) => {
    try {
      const projects = await getRecentProjects()
      res.json(projects)
    } catch (error) {
      console.error('Error getting projects:', error)
      res.status(500).json({ error: 'Failed to get projects' })
    }
  })

  // Add a project path
  router.post('/projects', async (req, res) => {
    try {
      const { path: projectPath, name } = req.body
      if (!projectPath) {
        return res.status(400).json({ error: 'Project path is required' })
      }
      await addProjectPath(projectPath, name)
      const projects = await getRecentProjects()
      res.status(201).json(projects)
    } catch (error) {
      console.error('Error adding project:', error)
      res.status(500).json({ error: 'Failed to add project' })
    }
  })

  // Get current storage folder info
  router.get('/storage-info', (req, res) => {
    try {
      const currentStorageFolder = req.storageFolder || config.storageFolder
      const parentDir = path.dirname(currentStorageFolder)
      res.json({
        storageFolder: currentStorageFolder,
        parentDir: parentDir
      })
    } catch (error) {
      console.error('Error getting storage info:', error)
      res.status(500).json({ error: 'Failed to get storage info' })
    }
  })

  // Browse file system - get directories for a given path
  router.get('/browse', async (req, res) => {
    try {
      const homeDir = os.homedir()
      const currentStorageFolder = req.storageFolder || config.storageFolder
      const defaultDir = path.dirname(currentStorageFolder) // Parent of current storage folder
      const dirPath = req.query.path as string || defaultDir
      
      // Security: ensure the path is within allowed directories
      const resolvedPath = path.resolve(dirPath)
      
      // Security: allow browsing within home directory, or in the same parent directory as current storage folder
      const isWithinHome = resolvedPath.startsWith(homeDir)
      const storageParentDir = path.dirname(currentStorageFolder)
      const isWithinStorageParent = resolvedPath.startsWith(storageParentDir) || storageParentDir.startsWith(resolvedPath)
      const isRootLevel = resolvedPath === '/' || resolvedPath.split(path.sep).length <= 2
      
      if (!isWithinHome && !isWithinStorageParent && !isRootLevel) {
        return res.status(403).json({ error: 'Access denied: Can only browse within home directory or current project area' })
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
      
      // Check if current directory itself is a .mxp or expedition folder
      const currentDirName = path.basename(resolvedPath)
      const currentIsMxpFolder = currentDirName === '.mxp' || currentDirName === 'expedition'
      const mxpPath = currentIsMxpFolder ? resolvedPath : null

      // Filter directories (exclude hidden directories except .mxp)
      const directories = entries
        .filter(entry => {
          if (!entry.isDirectory()) return false
          // Include .mxp and expedition folders, exclude other hidden folders
          if (entry.name === '.mxp' || entry.name === 'expedition') return true
          return !entry.name.startsWith('.')
        })
        .map(entry => ({
          name: entry.name,
          path: path.join(resolvedPath, entry.name),
          isMxpFolder: entry.name === '.mxp' || entry.name === 'expedition'
        }))
        .sort((a, b) => {
          // Sort .mxp and expedition folders first
          if (a.isMxpFolder && !b.isMxpFolder) return -1
          if (!a.isMxpFolder && b.isMxpFolder) return 1
          return a.name.localeCompare(b.name)
        })

      // For non-MXP directories, check if they contain .mxp or expedition folder
      const directoriesWithMxp = await Promise.all(
        directories.map(async (dir) => {
          if (dir.isMxpFolder) return dir
          try {
            const subEntries = await fs.readdir(dir.path, { withFileTypes: true })
            const hasMxp = subEntries.some(entry => 
              entry.isDirectory() && (entry.name === '.mxp' || entry.name === 'expedition')
            )
            return { ...dir, isMxpFolder: hasMxp }
          } catch {
            return { ...dir, isMxpFolder: false }
          }
        })
      )
      
      res.json({
        currentPath: resolvedPath,
        parentPath: resolvedPath !== '/' && resolvedPath !== homeDir && resolvedPath !== storageParentDir ? path.dirname(resolvedPath) : null,
        directories: directoriesWithMxp,
        currentIsMxpFolder: currentIsMxpFolder,
        mxpPath: mxpPath
      })
    } catch (error: any) {
      console.error('Error browsing directory:', error)
      res.status(500).json({ error: error.message || 'Failed to browse directory' })
    }
  })

  return router
}