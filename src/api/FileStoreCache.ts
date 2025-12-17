import { FileStore } from '../models/FileStore'
import { createFileStore } from '../models/FileStore'

// Cache FileStore instances by storage folder path
const fileStoreCache = new Map<string, FileStore>()

export const getFileStore = async (storageFolder: string): Promise<FileStore> => {
  if (fileStoreCache.has(storageFolder)) {
    return fileStoreCache.get(storageFolder)!
  }

  const fileStore = await createFileStore(storageFolder)
  fileStoreCache.set(storageFolder, fileStore)
  return fileStore
}


