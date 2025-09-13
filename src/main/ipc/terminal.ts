import * as os from 'os';

import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';

interface TerminalSession {
  id: string;
  pty: pty.IPty;
  cwd: string;
}

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupHandlers();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private setupHandlers() {
    // Get user home directory
    ipcMain.handle('terminal:getHomeDir', async () => {
      return os.homedir();
    });

    // Create a new terminal session
    ipcMain.handle('terminal:create', async (event, cwd?: string) => {
      try {
        const sessionId = `terminal-${Date.now()}`;
        const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
        const workingDir = cwd || process.env.HOME || process.cwd();

        // Spawn with -i flag for interactive shell
        const shellArgs = shell.includes('bash') ? ['-i'] : [];
        const ptyProcess = pty.spawn(shell, shellArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 30,
          cwd: workingDir,
          env: {
            ...process.env,
            COLORTERM: 'truecolor',
            TERM: 'xterm-256color',
            LANG: process.env.LANG || 'en_US.UTF-8',
            LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
          },
        });

        // Store session
        this.sessions.set(sessionId, {
          id: sessionId,
          pty: ptyProcess,
          cwd: workingDir,
        });

        // Set up data handler
        ptyProcess.onData((data) => {
          console.log(`[Terminal Main] Data received for ${sessionId}:`, data.length, 'bytes');
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('terminal:data', sessionId, data);
          }
        });

        // Set up exit handler
        ptyProcess.onExit(({ exitCode }) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('terminal:exit', sessionId, exitCode);
          }
          this.sessions.delete(sessionId);
        });

        // The interactive shell should send initial prompt automatically
        console.log(`[Terminal Main] Terminal session ${sessionId} created with interactive shell`);

        return { success: true, sessionId };
      } catch (error) {
        console.error('Failed to create terminal:', error);
        return { success: false, error: error.message };
      }
    });

    // Write data to terminal
    ipcMain.handle('terminal:write', async (event, sessionId: string, data: string) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.pty.write(data);
      }
    });

    // Resize terminal
    ipcMain.handle('terminal:resize', async (event, sessionId: string, cols: number, rows: number) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Validate dimensions before resizing
        if (!cols || !rows || cols <= 0 || rows <= 0) {
          console.warn(`[Terminal Main] Invalid resize dimensions for ${sessionId}: ${cols}x${rows}, skipping resize`);
          return;
        }

        // Also ensure they're integers
        const safeCols = Math.floor(cols);
        const safeRows = Math.floor(rows);

        if (safeCols > 0 && safeRows > 0) {
          console.log(`[Terminal Main] Resizing ${sessionId} to ${safeCols}x${safeRows}`);
          session.pty.resize(safeCols, safeRows);
        } else {
          console.warn(`[Terminal Main] Processed dimensions still invalid: ${safeCols}x${safeRows}`);
        }
      }
    });

    // Kill terminal session
    ipcMain.handle('terminal:kill', async (event, sessionId: string) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.pty.kill();
        this.sessions.delete(sessionId);
      }
    });

    // Get all sessions
    ipcMain.handle('terminal:list', async () => {
      return Array.from(this.sessions.keys());
    });
  }

  // Clean up all sessions
  cleanup() {
    for (const session of this.sessions.values()) {
      try {
        session.pty.kill();
      } catch (error) {
        console.error('Error killing terminal session:', error);
      }
    }
    this.sessions.clear();
  }
}

export const terminalManager = new TerminalManager();
