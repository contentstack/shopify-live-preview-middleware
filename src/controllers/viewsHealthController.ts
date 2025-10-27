import { FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

interface FileSystemItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  lastModified?: string;
  children?: FileSystemItem[];
}

interface ViewsHealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  viewsDirectory: {
    path: string;
    exists: boolean;
    writable: boolean;
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    contents: FileSystemItem[];
  };
  message?: string;
}

/**
 * Recursively scans a directory and returns its structure
 */
function scanDirectory(dirPath: string, relativePath: string = ''): FileSystemItem[] {
  const items: FileSystemItem[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      // Skip hidden files and directories (like .git, .DS_Store)
      if (entry.startsWith('.')) {
        continue;
      }
      
      const fullPath = path.join(dirPath, entry);
      const itemRelativePath = path.join(relativePath, entry);
      const stats = fs.statSync(fullPath);
      
      const item: FileSystemItem = {
        name: entry,
        type: stats.isDirectory() ? 'directory' : 'file',
        path: itemRelativePath || entry,
        lastModified: stats.mtime.toISOString()
      };
      
      if (stats.isFile()) {
        item.size = stats.size;
      } else if (stats.isDirectory()) {
        // Recursively scan subdirectories
        item.children = scanDirectory(fullPath, itemRelativePath);
      }
      
      items.push(item);
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return items.sort((a, b) => {
    // Sort directories first, then files, both alphabetically
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Calculates statistics from the file system structure
 */
function calculateStats(items: FileSystemItem[]): { files: number; directories: number; totalSize: number } {
  let files = 0;
  let directories = 0;
  let totalSize = 0;
  
  for (const item of items) {
    if (item.type === 'file') {
      files++;
      totalSize += item.size || 0;
    } else if (item.type === 'directory') {
      directories++;
      if (item.children) {
        const childStats = calculateStats(item.children);
        files += childStats.files;
        directories += childStats.directories;
        totalSize += childStats.totalSize;
      }
    }
  }
  
  return { files, directories, totalSize };
}

/**
 * Tests if a directory is writable
 */
function testWritePermission(dirPath: string): boolean {
  try {
    const testFile = path.join(dirPath, '.write-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export const viewsHealthHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const viewsPath = path.join(process.cwd(), 'views');
    const timestamp = new Date().toISOString();
    
    console.log(`Views health check requested at ${timestamp} for path: ${viewsPath}`);
    
    // Check if views directory exists
    const exists = fs.existsSync(viewsPath);
    
    if (!exists) {
      const response: ViewsHealthResponse = {
        status: 'error',
        timestamp,
        viewsDirectory: {
          path: viewsPath,
          exists: false,
          writable: false,
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          contents: []
        },
        message: 'Views directory does not exist'
      };
      
      reply.status(404);
      return response;
    }
    
    // Test write permissions
    const writable = testWritePermission(viewsPath);
    
    // Scan directory contents
    const contents = scanDirectory(viewsPath);
    const stats = calculateStats(contents);
    
    const response: ViewsHealthResponse = {
      status: 'ok',
      timestamp,
      viewsDirectory: {
        path: viewsPath,
        exists: true,
        writable,
        totalFiles: stats.files,
        totalDirectories: stats.directories,
        totalSize: stats.totalSize,
        contents
      }
    };
    
    // Add informational messages based on the state
    if (stats.files === 0 && stats.directories === 0) {
      response.message = 'Views directory is empty - no GitHub repository has been synced yet';
    } else {
      response.message = `Found ${stats.files} files and ${stats.directories} directories (${(stats.totalSize / 1024).toFixed(2)} KB total)`;
    }
    
    console.log(`Views health check completed: ${response.message}`);
    return response;
    
  } catch (error) {
    request.log.error('Error in viewsHealthHandler:', error);
    
    const response: ViewsHealthResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      viewsDirectory: {
        path: path.join(process.cwd(), 'views'),
        exists: false,
        writable: false,
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        contents: []
      },
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
    
    reply.status(500);
    return response;
  }
}; 