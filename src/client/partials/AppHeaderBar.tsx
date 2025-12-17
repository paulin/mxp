import React, { useState, useEffect } from 'react'
import { 
  Tooltip, 
  Switch, 
  FormControlLabel,
  Menu,
  MenuItem,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ListItemText,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Breadcrumbs,
  Link,
  Typography,
  Box
} from '@mui/material'
import {
  Add,
  ArrowRight,
  ArrowDropDown,
  Delete,
  VisibilityOutlined,
  VisibilityOffOutlined,
  Folder,
  AddCircle,
  FolderOpen,
  ArrowUpward,
  Home
} from '@mui/icons-material'
import type { TreeNode, TreeNodeSet } from '../../TreeNode'
import { TreeStateMethods } from '../../useApiForState'

interface ProjectPath {
  path: string
  name: string
  lastAccessed: number
}

interface AppHeaderBarProps {
  config: {
    projectTitle?: string
    workUnits?: string
    iconPath?: string
  }
  showDrafts: boolean
  setShowDrafts: (show: boolean) => void
  selectedNode: TreeNode | null
  addAndFocusNode: (nodeProperties: any, parentId: string, insertAtIndex?: number) => Promise<TreeNode>
  treeNodesApi: TreeStateMethods
  rootNodesByType: Record<string, TreeNode>
}

const styles = {
  header: {
    gridArea: 'header',
    borderBottom: '1px solid var(--border-color)',
    padding: '8px 8px',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--background-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    color: 'var(--text-primary)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
} as const

export const AppHeaderBar: React.FC<AppHeaderBarProps> = ({
  config,
  showDrafts,
  setShowDrafts,
  selectedNode,
  addAndFocusNode,
  treeNodesApi,
  rootNodesByType
}) => {
  const [projectsMenuAnchor, setProjectsMenuAnchor] = useState<null | HTMLElement>(null)
  const [projects, setProjects] = useState<ProjectPath[]>([])
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [browsePath, setBrowsePath] = useState<string>('')
  const [browseDirectories, setBrowseDirectories] = useState<Array<{name: string, path: string, isMxpFolder: boolean}>>([])
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [currentIsMxpFolder, setCurrentIsMxpFolder] = useState(false)
  const [currentMxpPath, setCurrentMxpPath] = useState<string | null>(null)
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)

  // Load recent projects
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(setProjects)
      .catch(console.error)
  }, [])

  const handleAddProject = async () => {
    if (!newProjectPath) return
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: newProjectPath, 
          name: newProjectName || undefined 
        })
      })
      if (response.ok) {
        const updated = await response.json()
        setProjects(updated)
        setAddProjectDialogOpen(false)
        setNewProjectPath('')
        setNewProjectName('')
      }
    } catch (error) {
      console.error('Error adding project:', error)
    }
  }

  const handleSwitchProject = async (projectPath: string) => {
    try {
      // Update last accessed
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath })
      })
      // Reload the page with new storage folder
      window.location.href = `/?storageFolder=${encodeURIComponent(projectPath)}`
    } catch (error) {
      console.error('Error switching project:', error)
    }
  }


  const getDefaultBrowseDirectory = async (): Promise<string> => {
    try {
      const response = await fetch('/api/storage-info')
      if (response.ok) {
        const data = await response.json()
        return data.parentDir
      }
    } catch (error) {
      console.error('Error getting storage info:', error)
    }
    // Fallback to home directory
    if (typeof window !== 'undefined') {
      const userAgent = navigator.platform.toLowerCase()
      if (userAgent.includes('win')) {
        return 'C:\\Users'
      } else if (userAgent.includes('mac')) {
        return '/Users'
      } else {
        return '/home'
      }
    }
    return '/'
  }

  const handleBrowseClick = async () => {
    setShowFileBrowser(true)
    const defaultDir = await getDefaultBrowseDirectory()
    await loadDirectory(defaultDir)
  }

  const loadDirectory = async (dirPath: string) => {
    try {
      const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`)
      if (response.ok) {
        const data = await response.json()
        setBrowsePath(data.currentPath)
        setBrowseDirectories(data.directories)
        setCurrentIsMxpFolder(data.currentIsMxpFolder || false)
        setCurrentMxpPath(data.mxpPath || null)
      }
    } catch (error) {
      console.error('Error loading directory:', error)
    }
  }

  const handleDirectoryClick = async (dirPath: string) => {
    await loadDirectory(dirPath)
  }

  const handleSelectMxpFolder = (mxpPath: string) => {
    setNewProjectPath(mxpPath)
    setSelectedFolderPath(mxpPath)
    if (!newProjectName) {
      // Extract project name from path
      const pathParts = mxpPath.split(/[/\\]/)
      const projectName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1]
      setNewProjectName(projectName)
    }
  }

  const handleFolderClick = async (dirPath: string, isMxpFolder: boolean) => {
    if (isMxpFolder) {
      // If it's an MXP folder, select it
      handleSelectMxpFolder(dirPath)
    } else {
      // Otherwise, navigate into it
      await handleDirectoryClick(dirPath)
      setSelectedFolderPath(null) // Clear selection when navigating
    }
  }

  return (
    <header style={styles.header}>
      <img
        src={config.iconPath || "/expedition-logo-256-alpha.png"}
        alt="Project Logo"
        style={{ height: '24px', marginRight: '16px' }}
      />
      <h1 style={styles.title}>
        {config.projectTitle || "MXP: Method Expedition"}
      </h1>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Project switcher */}
        <Tooltip title="Switch Project">
          <IconButton
            size="small"
            onClick={(e) => setProjectsMenuAnchor(e.currentTarget)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            <Folder />
          </IconButton>
        </Tooltip>
        
        <Menu
          anchorEl={projectsMenuAnchor}
          open={Boolean(projectsMenuAnchor)}
          onClose={() => setProjectsMenuAnchor(null)}
          PaperProps={{
            style: {
              maxHeight: 400,
              width: '300px'
            }
          }}
        >
          <MenuItem 
            onClick={() => {
              setAddProjectDialogOpen(true)
              setProjectsMenuAnchor(null)
            }}
          >
            <AddCircle sx={{ mr: 1, fontSize: 18 }} /> Add Project
          </MenuItem>
          {projects.length > 0 && <Divider />}
          {projects.map((project) => (
            <MenuItem 
              key={project.path}
              onClick={() => {
                handleSwitchProject(project.path)
                setProjectsMenuAnchor(null)
              }}
            >
              <ListItemText 
                primary={project.name}
                secondary={project.path}
                secondaryTypographyProps={{
                  style: {
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }
                }}
              />
            </MenuItem>
          ))}
          {projects.length === 0 && (
            <MenuItem disabled>
              <ListItemText 
                primary="No projects yet"
                secondary="Click 'Add Project' to get started"
                secondaryTypographyProps={{ style: { fontSize: '11px' } }}
              />
            </MenuItem>
          )}
        </Menu>

        {/* Add Project Dialog */}
        <Dialog 
          open={addProjectDialogOpen} 
          onClose={() => {
            setAddProjectDialogOpen(false)
            setNewProjectPath('')
            setNewProjectName('')
            setShowFileBrowser(false)
            setSelectedFolderPath(null)
          }} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>Add Project Folder</DialogTitle>
          <DialogContent>
            {!showFileBrowser ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <TextField
                    autoFocus
                    margin="dense"
                    label="Project Path"
                    fullWidth
                    variant="outlined"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="/path/to/project/.mxp"
                    helperText="Path to the .mxp folder in your project"
                  />
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpen />}
                    onClick={handleBrowseClick}
                    sx={{ mt: 1, minWidth: 120 }}
                  >
                    Browse
                  </Button>
                </div>
                <TextField
                  margin="dense"
                  label="Project Name (optional)"
                  fullWidth
                  variant="outlined"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Project"
                  helperText="A friendly name for this project"
                  sx={{ mt: 2 }}
                />
              </>
            ) : (
              <Box sx={{ mt: 2, minHeight: 400 }}>
                <Breadcrumbs sx={{ mb: 2 }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={async () => {
                      const defaultDir = await getDefaultBrowseDirectory()
                      await loadDirectory(defaultDir)
                    }}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Home sx={{ fontSize: 16 }} /> Project Area
                  </Link>
                  {browsePath && (
                    <Typography variant="body2" color="text.primary">
                      {browsePath.split(/[/\\]/).pop() || browsePath}
                    </Typography>
                  )}
                </Breadcrumbs>
                {currentIsMxpFolder && currentMxpPath && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'primary.contrastText' }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      MXP Project Folder Found!
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {currentMxpPath}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSelectMxpFolder(currentMxpPath)}
                      sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                    >
                      Select This Folder
                    </Button>
                  </Box>
                )}
                <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  {browsePath && (
                    <ListItem disablePadding>
                      <ListItemButton onClick={async () => {
                        try {
                          const response = await fetch(`/api/browse?path=${encodeURIComponent(browsePath)}`)
                          if (response.ok) {
                            const data = await response.json()
                            if (data.parentPath) {
                              await loadDirectory(data.parentPath)
                            } else {
                              // If no parent path, go to default directory
                              const defaultDir = await getDefaultBrowseDirectory()
                              await loadDirectory(defaultDir)
                            }
                          }
                        } catch (error) {
                          console.error('Error loading parent:', error)
                        }
                      }}>
                        <ArrowUpward sx={{ mr: 1 }} />
                        <ListItemText primary=".." secondary="Parent directory" />
                      </ListItemButton>
                    </ListItem>
                  )}
                  {browseDirectories.map((dir) => {
                    const isSelected = selectedFolderPath === dir.path
                    return (
                      <ListItem key={dir.path} disablePadding>
                        <ListItemButton
                          onClick={() => handleFolderClick(dir.path, dir.isMxpFolder)}
                          onDoubleClick={() => {
                            if (dir.isMxpFolder) {
                              handleSelectMxpFolder(dir.path)
                              setShowFileBrowser(false)
                            }
                          }}
                          sx={{
                            backgroundColor: isSelected ? 'primary.light' : (dir.isMxpFolder ? 'action.selected' : 'transparent'),
                            '&:hover': {
                              backgroundColor: isSelected ? 'primary.main' : 'action.hover'
                            }
                          }}
                        >
                          <Folder sx={{ mr: 1, color: dir.isMxpFolder ? 'primary.main' : 'inherit' }} />
                          <ListItemText 
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{dir.name}</span>
                                {dir.isMxpFolder && (
                                  <Typography variant="caption" sx={{ 
                                    bgcolor: 'primary.main', 
                                    color: 'white', 
                                    px: 0.5, 
                                    py: 0.25, 
                                    borderRadius: 0.5,
                                    fontSize: '10px'
                                  }}>
                                    MXP
                                  </Typography>
                                )}
                                {isSelected && (
                                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                                    Selected
                                  </Typography>
                                )}
                              </Box>
                            }
                            secondary={dir.isMxpFolder ? 'Double-click to select' : 'Click to open'}
                          />
                        </ListItemButton>
                      </ListItem>
                    )
                  })}
                </List>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {showFileBrowser && (
              <Button onClick={() => setShowFileBrowser(false)}>Back</Button>
            )}
            <Button onClick={() => {
              setAddProjectDialogOpen(false)
              setNewProjectPath('')
              setNewProjectName('')
              setShowFileBrowser(false)
            }}>Cancel</Button>
            {!showFileBrowser && (
              <Button onClick={handleAddProject} variant="contained" disabled={!newProjectPath}>
                Add
              </Button>
            )}
            {showFileBrowser && selectedFolderPath && (
              <Button 
                onClick={() => {
                  handleSelectMxpFolder(selectedFolderPath)
                  setShowFileBrowser(false)
                }} 
                variant="contained"
              >
                Select {selectedFolderPath.split(/[/\\]/).pop()}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Global drafts toggle */}
        <Tooltip title={showDrafts ? "Hide draft items" : "Show draft items"}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showDrafts}
                onChange={(e) => setShowDrafts(e.target.checked)}
              />
            }
            label={
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {showDrafts ?
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <VisibilityOutlined sx={{ fontSize: 14 }} /> Drafts
                  </span> :
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <VisibilityOffOutlined sx={{ fontSize: 14 }} /> Drafts
                  </span>
                }
              </span>
            }
            style={{ margin: 0 }}
          />
        </Tooltip>

        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Add Child (⌘+Enter / Ctrl+Enter)">
            <span>
              <button
                onClick={async () => {
                  if (selectedNode) {
                    await addAndFocusNode({ title: '' }, selectedNode.id)
                  }
                }}
                disabled={!selectedNode}
                style={{
                  opacity: selectedNode ? 1 : 0.5,
                  cursor: selectedNode ? 'pointer' : 'default',
                  padding: 4,
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  position: 'relative'
                }}
              >
                <Add sx={{ fontSize: 14, position: 'absolute', right: 0, bottom: 0 }} />
                <ArrowRight sx={{ fontSize: 18 }} />
              </button>
            </span>
          </Tooltip>
          <Tooltip title="Add Sibling (Shift+Enter)">
            <span>
              <button
                onClick={async () => {
                  if (selectedNode?.parentId) {
                    await addAndFocusNode({ title: '' }, selectedNode.parentId)
                  }
                }}
                disabled={!selectedNode?.parentId}
                style={{
                  opacity: selectedNode?.parentId ? 1 : 0.5,
                  cursor: selectedNode?.parentId ? 'pointer' : 'default',
                  padding: 4,
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  position: 'relative'
                }}
              >
                <Add sx={{ fontSize: 14, position: 'absolute', right: 0, bottom: 0 }} />
                <ArrowDropDown sx={{ fontSize: 18 }} />
              </button>
            </span>
          </Tooltip>
          <Tooltip title="Delete node (Delete / Backspace)">
            <span>
              <button
                onClick={async () => selectedNode && await treeNodesApi.removeNode(selectedNode.id)}
                disabled={!selectedNode || Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id)}
                style={{
                  opacity: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 1 : 0.5,
                  cursor: selectedNode && !Object.values(rootNodesByType).some(rootNode => rootNode.id === selectedNode?.id) ? 'pointer' : 'default',
                  padding: 4,
                  background: 'none',
                  border: 'none',
                  color: '#666'
                }}
              >
                <Delete sx={{ fontSize: 18 }} />
              </button>
            </span>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}