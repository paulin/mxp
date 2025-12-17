import fs from 'fs/promises'
import path from 'path'
import { startServer } from './server.js'
import { execSync } from 'child_process'
import { createInterface } from 'readline'

const isGitRepo = (dir: string) => {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const askQuestion = async (query: string): Promise<string> => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

export const main = async (startDir: string = process.cwd()) => {
  // Check if .mxp directory exists (new standard name)
  const mxpDir = path.join(startDir, '.mxp')
  
  // Also check for legacy 'expedition' directory for backward compatibility
  const expeditionDir = path.join(startDir, 'expedition')
  
  let storageFolder: string
  
  try {
    await fs.access(mxpDir)
    storageFolder = mxpDir
  } catch {
    try {
      // Check for legacy expedition folder
      await fs.access(expeditionDir)
      storageFolder = expeditionDir
      console.warn('Note: Using legacy "expedition" folder. Consider renaming it to ".mxp"')
    } catch {
      // Directory doesn't exist, check if we're in a git repo
      const isGit = isGitRepo(startDir)
      if (!isGit) {
        console.warn('Warning: MXP is intended to be used within a git repository.')
      }

      const answer = await askQuestion('.mxp directory not found. Create it? (y/N) ')
      if (answer.toLowerCase() !== 'y') {
        console.log('Exiting...')
        process.exit(0)
      }

      // Create .mxp directory
      await fs.mkdir(mxpDir, { recursive: true })
      storageFolder = mxpDir
    }
  }

  // Start the server
  const { server } = await startServer({
    storageFolder: storageFolder,
    port: 0, // let the OS assign a port
    autoOpenInBrowser: true
  })

  return { server }
}
