import { ipcMain, BrowserWindow } from 'electron';

import { ClaudeQueryOptions, ClaudeIPCResponse, ClaudeServiceStatus } from '../../shared/types/claude';
import { ClaudeService } from '../services/claudeService';

export function setupClaudeHandlers(mainWindow: BrowserWindow): void {
  const claudeService = ClaudeService.getInstance();
  claudeService.setMainWindow(mainWindow);

  // Send message to Claude
  ipcMain.handle(
    'claude:sendMessage',
    async (
      event,
      taskId: string,
      message: string,
      options?: Partial<ClaudeQueryOptions>
    ): Promise<ClaudeIPCResponse<{ messageId: string }>> => {
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

  // Handle window close - cancel all queries
  mainWindow.on('close', () => {
    claudeService.cancelAllQueries();
  });
}
