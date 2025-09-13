import { Options } from '@anthropic-ai/claude-code';
import { ipcMain, BrowserWindow } from 'electron';

import { ClaudeIPCResponse, ClaudeServiceStatus } from '../../shared/types/claude';
import { ClaudeService } from '../services/claudeService';

let handlersRegistered = false;

export function setupClaudeHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    console.log('[Claude] IPC handlers already registered, skipping...');
    return;
  }
  handlersRegistered = true;
  console.log('[Claude] Registering IPC handlers...');

  const claudeService = ClaudeService.getInstance();
  claudeService.setMainWindow(mainWindow);

  // Send message to Claude
  ipcMain.handle(
    'claude:sendMessage',
    async (
      event,
      taskId: string,
      message: string,
      options?: Partial<Options>
    ): Promise<ClaudeIPCResponse<{ sessionId?: string }>> => {
      try {
        const result = await claudeService.sendMessage(taskId, message, options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('Failed to send Claude message:', error);
        return {
          success: false,
          error: error.message || 'Failed to send message to Claude',
        };
      }
    }
  );

  // Cancel a specific Claude query
  ipcMain.handle('claude:cancelQuery', async (event, messageId: string): Promise<ClaudeIPCResponse<boolean>> => {
    try {
      const cancelled = claudeService.cancelQuery(messageId);
      return {
        success: true,
        data: cancelled,
      };
    } catch (error) {
      console.error('Failed to cancel Claude query:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel query',
      };
    }
  });

  // Get Claude service status
  ipcMain.handle('claude:getStatus', async (): Promise<ClaudeIPCResponse<ClaudeServiceStatus>> => {
    try {
      const status = claudeService.getStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      console.error('Failed to get Claude status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get status',
      };
    }
  });

  // Cancel all Claude queries
  ipcMain.handle('claude:cancelAll', async (): Promise<ClaudeIPCResponse<void>> => {
    try {
      claudeService.cancelAllQueries();
      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to cancel all Claude queries:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel all queries',
      };
    }
  });

  // Get log file path
  ipcMain.handle('claude:getLogFilePath', async (): Promise<ClaudeIPCResponse<string>> => {
    try {
      const logPath = claudeService.getLogFilePath();
      return {
        success: true,
        data: logPath,
      };
    } catch (error) {
      console.error('Failed to get log file path:', error);
      return {
        success: false,
        error: error.message || 'Failed to get log file path',
      };
    }
  });

  // Handle window close - cancel all queries
  mainWindow.on('close', () => {
    claudeService.cancelAllQueries();
  });
}
