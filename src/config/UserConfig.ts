import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface ProjectPath {
  path: string
  name: string
  lastAccessed: number
}

export interface UserConfig {
  projects: ProjectPath[]
}

const getConfigDir = () => {
  const homeDir = os.homedir()
  return path.join(homeDir, '.mxp')
}

const getConfigPath = () => {
  return path.join(getConfigDir(), 'config.json')
}

export const loadUserConfig = async (): Promise<UserConfig> => {
  const configPath = getConfigPath()
  try {
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    // Return default config if file doesn't exist
    return { projects: [] }
  }
}

export const saveUserConfig = async (config: UserConfig): Promise<void> => {
  const configDir = getConfigDir()
  const configPath = getConfigPath()
  
  // Ensure config directory exists
  await fs.mkdir(configDir, { recursive: true })
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
}

export const addProjectPath = async (projectPath: string, name?: string): Promise<void> => {
  const config = await loadUserConfig()
  const existingIndex = config.projects.findIndex(p => p.path === projectPath)
  
  const projectName = name || path.basename(projectPath)
  
  if (existingIndex >= 0) {
    // Update existing project
    config.projects[existingIndex].lastAccessed = Date.now()
    if (name) {
      config.projects[existingIndex].name = projectName
    }
  } else {
    // Add new project
    config.projects.push({
      path: projectPath,
      name: projectName,
      lastAccessed: Date.now()
    })
  }
  
  // Sort by last accessed (most recent first)
  config.projects.sort((a, b) => b.lastAccessed - a.lastAccessed)
  
  await saveUserConfig(config)
}

export const getRecentProjects = async (limit: number = 10): Promise<ProjectPath[]> => {
  const config = await loadUserConfig()
  return config.projects.slice(0, limit)
}


