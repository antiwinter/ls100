import fs from 'fs/promises'
import path from 'path'

export class Storage {
  constructor(config) {
    this.type = config.type // 'local' | 'minio' | 's3'
    this.basePath = config.basePath
  }

  async put(key, data) {
    if (this.type === 'local') {
      return this.putLocal(key, data)
    }
    // Future: this.putOSS(key, data)
  }

  async get(key) {
    if (this.type === 'local') {
      return this.getLocal(key)
    }
    // Future: this.getOSS(key)
  }

  async exists(key) {
    if (this.type === 'local') {
      return this.existsLocal(key)
    }
    // Future: this.existsOSS(key)
  }

  async delete(key) {
    if (this.type === 'local') {
      return this.deleteLocal(key)
    }
    // Future: this.deleteOSS(key)
  }

  // Local file system implementation
  async putLocal(key, data) {
    const filePath = path.join(this.basePath, key)
    const dirPath = path.dirname(filePath)
    
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true })
    
    // Write the file
    return fs.writeFile(filePath, data)
  }

  getLocal(key) {
    const filePath = path.join(this.basePath, key)
    return fs.readFile(filePath)
  }

  async existsLocal(key) {
    const filePath = path.join(this.basePath, key)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  deleteLocal(key) {
    const filePath = path.join(this.basePath, key)
    return fs.unlink(filePath)
  }
} 