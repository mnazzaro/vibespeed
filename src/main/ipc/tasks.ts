import { ipcMain, BrowserWindow } from 'electron';

import { CreateTaskParams, TaskIPCResponse, Task, ChatMessage, WorktreeProgress } from '../../shared/types/tasks';
import { GitManager } from '../services/gitManager';
import { TaskManager } from '../services/taskManager';

let handlersRegistered = false;

export function setupTaskHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    console.log('[Tasks] IPC handlers already registered, skipping...');
    return;
  }
  handlersRegistered = true;
  console.log('[Tasks] Registering IPC handlers...');

  const taskManager = TaskManager.getInstance();
  const gitManager = GitManager.getInstance();

  // Create new task
  ipcMain.handle('task:create', async (event, params: CreateTaskParams): Promise<TaskIPCResponse<Task>> => {
    try {
      const task = await taskManager.createTask(params);
      return {
        success: true,
        data: task,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to create task',
      };
    }
  });

  // List all tasks
  ipcMain.handle('task:list', async (): Promise<TaskIPCResponse<{ tasks: Task[]; activeTaskId: string | null }>> => {
    try {
      const tasks = taskManager.getAllTasks();
      const activeTask = taskManager.getActiveTask();

      return {
        success: true,
        data: {
          tasks,
          activeTaskId: activeTask?.id || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to list tasks',
      };
    }
  });

  // Get specific task
  ipcMain.handle('task:get', async (event, taskId: string): Promise<TaskIPCResponse<Task>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      return {
        success: true,
        data: task,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get task',
      };
    }
  });

  // Update task
  ipcMain.handle(
    'task:update',
    async (event, taskId: string, updates: Partial<Task>): Promise<TaskIPCResponse<Task>> => {
      try {
        const updatedTask = taskManager.updateTask(taskId, updates);

        if (!updatedTask) {
          throw new Error('Task not found');
        }

        return {
          success: true,
          data: updatedTask,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to update task',
        };
      }
    }
  );

  // Delete task
  ipcMain.handle('task:delete', async (event, taskId: string): Promise<TaskIPCResponse<void>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (task) {
        // Clean up worktrees
        for (const repo of task.repositories) {
          try {
            await gitManager.removeWorktree(repo.worktreePath);
          } catch (error) {
            console.error(`Failed to remove worktree for ${repo.name}:`, error);
          }
        }

        // Clean up the entire task directory
        const fs = require('fs');
        const taskDir = task.worktreeBasePath;
        if (fs.existsSync(taskDir)) {
          try {
            fs.rmSync(taskDir, { recursive: true, force: true });
            console.log(`Cleaned up task directory: ${taskDir}`);
          } catch (error) {
            console.error(`Failed to remove task directory ${taskDir}:`, error);
          }
        }
      }

      const success = taskManager.deleteTask(taskId);

      if (!success) {
        throw new Error('Task not found');
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to delete task',
      };
    }
  });

  // Set active task
  ipcMain.handle('task:setActive', async (event, taskId: string): Promise<TaskIPCResponse<void>> => {
    try {
      taskManager.setActiveTask(taskId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to set active task',
      };
    }
  });

  // Setup worktrees for a task
  ipcMain.handle('task:setupWorktrees', async (event, taskId: string): Promise<TaskIPCResponse<void>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      // Setup each repository's worktree
      for (const repo of task.repositories) {
        // Send progress updates to renderer
        const onProgress = (progress: WorktreeProgress) => {
          mainWindow.webContents.send('task:worktree-progress', progress);
        };

        try {
          await gitManager.setupWorktree(repo, taskId, onProgress);
          taskManager.updateRepositoryStatus(taskId, repo.id, 'ready');

          // Also send a final ready status to ensure frontend gets it
          mainWindow.webContents.send('task:worktree-progress', {
            taskId,
            repositoryId: repo.id,
            status: 'ready',
            message: 'Setup complete',
          });
        } catch (error) {
          console.error(`Failed to setup worktree for ${repo.name}:`, error);
          taskManager.updateRepositoryStatus(taskId, repo.id, 'error', error.message);

          // Also send a final error status to ensure frontend gets it
          mainWindow.webContents.send('task:worktree-progress', {
            taskId,
            repositoryId: repo.id,
            status: 'error',
            message: error.message || 'Setup failed',
          });
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to setup worktrees',
      };
    }
  });

  // Send message to task
  ipcMain.handle(
    'task:sendMessage',
    async (
      event,
      taskId: string,
      message: Omit<ChatMessage, 'id' | 'timestamp'>
    ): Promise<TaskIPCResponse<ChatMessage>> => {
      try {
        const newMessage = taskManager.addMessage(taskId, message);

        if (!newMessage) {
          throw new Error('Failed to add message');
        }

        // Claude integration happens via the ClaudeService now

        return {
          success: true,
          data: newMessage,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to send message',
        };
      }
    }
  );

  // Open task in file explorer
  ipcMain.handle('task:openInExplorer', async (event, taskId: string): Promise<TaskIPCResponse<void>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      const { shell } = require('electron');
      shell.openPath(task.worktreeBasePath);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to open task folder',
      };
    }
  });

  // Open repository in VS Code
  ipcMain.handle(
    'task:openInEditor',
    async (event, taskId: string, repositoryName: string): Promise<TaskIPCResponse<void>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repositoryName);
        if (!repo) {
          throw new Error('Repository not found in task');
        }

        const { exec } = require('child_process');
        exec(`code "${repo.worktreePath}"`, (error: any) => {
          if (error) {
            console.error('Failed to open in VS Code:', error);
          }
        });

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to open in editor',
        };
      }
    }
  );

  // Get git status for all repositories in a task
  ipcMain.handle('task:getGitStatus', async (event, taskId: string): Promise<TaskIPCResponse<any>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      const statusByRepo: Record<string, any> = {};

      for (const repo of task.repositories) {
        if (repo.status === 'ready' && repo.worktreePath) {
          const status = await gitManager.getWorktreeStatus(repo.worktreePath);
          if (status) {
            // Convert to serializable object, removing methods
            statusByRepo[repo.name] = {
              current: status.current,
              tracking: status.tracking,
              ahead: status.ahead,
              behind: status.behind,
              created: status.created || [],
              deleted: status.deleted || [],
              modified: status.modified || [],
              renamed: status.renamed || [],
              conflicted: status.conflicted || [],
              staged: status.staged || [],
              files: status.files || [],
              not_added: status.not_added || [],
              isClean: status.files?.length === 0,
            };
          }
        }
      }

      return {
        success: true,
        data: statusByRepo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get git status',
      };
    }
  });

  // Get git diff statistics for a repository
  ipcMain.handle('task:getGitDiff', async (event, taskId: string, repoName: string): Promise<TaskIPCResponse<any>> => {
    try {
      const task = taskManager.getTask(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      const repo = task.repositories.find((r) => r.name === repoName);
      if (!repo || !repo.worktreePath) {
        throw new Error('Repository not found or not ready');
      }

      const diffs = await gitManager.getDiffStats(repo.worktreePath);

      return {
        success: true,
        data: diffs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get git diff',
      };
    }
  });

  // Stage or unstage files
  ipcMain.handle(
    'task:stageFiles',
    async (
      event,
      taskId: string,
      repoName: string,
      files: string[],
      stage: boolean
    ): Promise<TaskIPCResponse<void>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repoName);
        if (!repo || !repo.worktreePath) {
          throw new Error('Repository not found or not ready');
        }

        if (stage) {
          await gitManager.stageFiles(repo.worktreePath, files);
        } else {
          await gitManager.unstageFiles(repo.worktreePath, files);
        }

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to stage/unstage files',
        };
      }
    }
  );

  // Get file diff content
  ipcMain.handle(
    'task:getFileDiff',
    async (event, taskId: string, repoName: string, filePath: string): Promise<TaskIPCResponse<string>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repoName);
        if (!repo || !repo.worktreePath) {
          throw new Error('Repository not found or not ready');
        }

        const diff = await gitManager.getFileDiff(repo.worktreePath, filePath);

        return {
          success: true,
          data: diff,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to get file diff',
        };
      }
    }
  );

  // Get file content with context (for expanding diff view)
  ipcMain.handle(
    'task:getFileContext',
    async (
      event,
      taskId: string,
      repoName: string,
      filePath: string,
      startLine: number,
      endLine: number
    ): Promise<TaskIPCResponse<string[]>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repoName);
        if (!repo || !repo.worktreePath) {
          throw new Error('Repository not found or not ready');
        }

        const lines = await gitManager.getFileContext(repo.worktreePath, filePath, startLine, endLine);

        return {
          success: true,
          data: lines,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to get file context',
        };
      }
    }
  );

  // Get full file diff with unified format
  ipcMain.handle(
    'task:getFullFileDiff',
    async (
      event,
      taskId: string,
      repoName: string,
      filePath: string,
      context: number = 3
    ): Promise<TaskIPCResponse<string>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repoName);
        if (!repo || !repo.worktreePath) {
          throw new Error('Repository not found or not ready');
        }

        const diff = await gitManager.getFullFileDiff(repo.worktreePath, filePath, context);

        return {
          success: true,
          data: diff,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to get full file diff',
        };
      }
    }
  );

  // Commit changes
  ipcMain.handle(
    'task:commit',
    async (event, taskId: string, repoName: string, message: string): Promise<TaskIPCResponse<void>> => {
      try {
        const task = taskManager.getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        const repo = task.repositories.find((r) => r.name === repoName);
        if (!repo || !repo.worktreePath) {
          throw new Error('Repository not found or not ready');
        }

        await gitManager.commitChanges(repo.worktreePath, message);

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to commit changes',
        };
      }
    }
  );
}
