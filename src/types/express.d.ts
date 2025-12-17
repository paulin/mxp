import { FileStore } from '../models/FileStore'

declare global {
  namespace Express {
    interface Request {
      fileStore?: FileStore
      storageFolder?: string
    }
  }
}

export {}


