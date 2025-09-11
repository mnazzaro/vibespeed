import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import * as chokidar from 'chokidar';
import { ipcMain, BrowserWindow } from 'electron';

import { FileNode } from '../../shared/types/panes';

class FileManager {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupHandlers();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private setupHandlers() {
    // Read directory contents
    ipcMain.handle('files:readDirectory', async (event, dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files: FileNode[] = [];

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          let stats: fsSync.Stats | null = null;

          try {
            stats = await fs.stat(fullPath);
          } catch (_error) {
            // Skip files we can't access
            continue;
          }

          const node: FileNode = {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats?.size,
            modified: stats?.mtimeMs,
            extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
          };

          files.push(node);
        }

        return files;
      } catch (error) {
        console.error('Failed to read directory:', error);
        throw error;
      }
    });

    // Read file contents
    ipcMain.handle('files:readFile', async (event, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      } catch (error) {
        console.error('Failed to read file:', error);
        throw error;
      }
    });

    // Write file
    ipcMain.handle('files:writeFile', async (event, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
      } catch (error) {
        console.error('Failed to write file:', error);
        throw error;
      }
    });

    // Create directory
    ipcMain.handle('files:createDirectory', async (event, dirPath: string) => {
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        console.error('Failed to create directory:', error);
        throw error;
      }
    });

    // Delete file or directory
    ipcMain.handle('files:delete', async (event, filePath: string) => {
      try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.unlink(filePath);
        }
      } catch (error) {
        console.error('Failed to delete:', error);
        throw error;
      }
    });

    // Rename/move file or directory
    ipcMain.handle('files:rename', async (event, oldPath: string, newPath: string) => {
      try {
        await fs.rename(oldPath, newPath);
      } catch (error) {
        console.error('Failed to rename:', error);
        throw error;
      }
    });

    // Get file info
    ipcMain.handle('files:getFileInfo', async (event, filePath: string) => {
      try {
        const stats = await fs.stat(filePath);
        const name = path.basename(filePath);

        const node: FileNode = {
          name,
          path: filePath,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtimeMs,
          extension: stats.isFile() ? path.extname(name).slice(1) : undefined,
        };

        return node;
      } catch (error) {
        console.error('Failed to get file info:', error);
        throw error;
      }
    });

    // Watch directory for changes
    ipcMain.handle('files:watch', async (event, dirPath: string) => {
      try {
        // Don't create duplicate watchers
        if (this.watchers.has(dirPath)) {
          return;
        }

        const watcher = chokidar.watch(dirPath, {
          persistent: true,
          ignoreInitial: true,
          depth: 0, // Only watch immediate children
          ignorePermissionErrors: true,
        });

        watcher.on('add', (filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files:changed', filePath, 'add');
          }
        });

        watcher.on('change', (filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files:changed', filePath, 'change');
          }
        });

        watcher.on('unlink', (filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files:changed', filePath, 'unlink');
          }
        });

        watcher.on('addDir', (filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files:changed', filePath, 'add');
          }
        });

        watcher.on('unlinkDir', (filePath) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files:changed', filePath, 'unlink');
          }
        });

        this.watchers.set(dirPath, watcher);
      } catch (error) {
        console.error('Failed to watch directory:', error);
        throw error;
      }
    });

    // Stop watching directory
    ipcMain.handle('files:unwatch', async (event, dirPath: string) => {
      const watcher = this.watchers.get(dirPath);
      if (watcher) {
        await watcher.close();
        this.watchers.delete(dirPath);
      }
    });

    // Open file in editor (VS Code)
    ipcMain.handle('files:openInEditor', async (event, filePath: string) => {
      try {
        const { exec } = require('child_process');
        exec(`code "${filePath}"`, (error: any) => {
          if (error) {
            console.error('Failed to open in VS Code:', error);
            throw error;
          }
        });
      } catch (error) {
        console.error('Failed to open file in editor:', error);
        throw error;
      }
    });
  }

  // Clean up all watchers
  async cleanup() {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
  }
}

export const fileManager = new FileManager();
