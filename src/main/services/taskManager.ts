import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskRepository, CreateTaskParams, TaskStoreData, ChatMessage } from '../../shared/types/tasks';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class TaskManager {
  private static instance: TaskManager;
  private store: Store<TaskStoreData>;
  private tasksBasePath: string;
  
  private constructor() {
    this.store = new Store<TaskStoreData>({
      name: 'vibespeed-tasks',
      defaults: {
        tasks: [],
        activeTaskId: null,
        lastUpdated: Date.now()
      }
    });
    
    // Set up base path for all task worktrees
    this.tasksBasePath = path.join(app.getPath('documents'), 'vibespeed-tasks');
    this.ensureTasksDirectory();
  }
  
  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }
  
  private ensureTasksDirectory(): void {
    if (!fs.existsSync(this.tasksBasePath)) {
      fs.mkdirSync(this.tasksBasePath, { recursive: true });
    }
  }
  
  public async createTask(params: CreateTaskParams): Promise<Task> {
    const taskId = uuidv4();
    const taskName = this.generateTaskName(params.repositories);
    const taskPath = path.join(this.tasksBasePath, `task-${taskId}`);
    
    // Create task directory
    if (!fs.existsSync(taskPath)) {
      fs.mkdirSync(taskPath, { recursive: true });
    }
    
    // Use short ID for branch names to ensure uniqueness
    const shortId = taskId.slice(0, 8);
    
    // Build repository entries
    const repositories: TaskRepository[] = params.repositories.map(repo => ({
      id: repo.id,
      installationId: repo.installationId,
      name: repo.name,
      fullName: repo.fullName,
      originalBranch: repo.defaultBranch || 'main',
      taskBranch: `task/${shortId}/${repo.name}`,
      worktreePath: path.join(taskPath, repo.name),
      status: 'initializing' as const
    }));
    
    const task: Task = {
      id: taskId,
      name: taskName,
      repositories,
      worktreeBasePath: taskPath,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    // Save to store
    const tasks = this.store.get('tasks', []);
    tasks.push(task);
    this.store.set('tasks', tasks);
    this.store.set('activeTaskId', taskId);
    this.store.set('lastUpdated', Date.now());
    
    // Save task metadata to task directory
    this.saveTaskMetadata(task);
    
    return task;
  }
  
  public getAllTasks(): Task[] {
    return this.store.get('tasks', []);
  }
  
  public getTask(taskId: string): Task | null {
    const tasks = this.store.get('tasks', []);
    return tasks.find(t => t.id === taskId) || null;
  }
  
  public getActiveTask(): Task | null {
    const activeTaskId = this.store.get('activeTaskId');
    if (!activeTaskId) return null;
    return this.getTask(activeTaskId);
  }
  
  public setActiveTask(taskId: string): void {
    const task = this.getTask(taskId);
    if (task) {
      this.store.set('activeTaskId', taskId);
      this.store.set('lastUpdated', Date.now());
    }
  }
  
  public updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const tasks = this.store.get('tasks', []);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const updatedTask = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    tasks[taskIndex] = updatedTask;
    this.store.set('tasks', tasks);
    this.store.set('lastUpdated', Date.now());
    
    // Update task metadata file
    this.saveTaskMetadata(updatedTask);
    
    return updatedTask;
  }
  
  public updateRepositoryStatus(
    taskId: string, 
    repositoryId: number, 
    status: TaskRepository['status'],
    errorMessage?: string
  ): void {
    const task = this.getTask(taskId);
    if (!task) return;
    
    const repositories = task.repositories.map(repo => {
      if (repo.id === repositoryId) {
        return { ...repo, status, errorMessage };
      }
      return repo;
    });
    
    this.updateTask(taskId, { repositories });
  }
  
  public addMessage(taskId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage | null {
    const task = this.getTask(taskId);
    if (!task) return null;
    
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date()
    };
    
    const messages = [...task.messages, newMessage];
    this.updateTask(taskId, { messages });
    
    return newMessage;
  }
  
  public deleteTask(taskId: string): boolean {
    const tasks = this.store.get('tasks', []);
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    
    if (filteredTasks.length === tasks.length) return false;
    
    // Update active task if we're deleting it
    const activeTaskId = this.store.get('activeTaskId');
    if (activeTaskId === taskId) {
      const newActiveTask = filteredTasks[0];
      this.store.set('activeTaskId', newActiveTask?.id || null);
    }
    
    this.store.set('tasks', filteredTasks);
    this.store.set('lastUpdated', Date.now());
    
    // Clean up task directory (but keep the worktrees for safety)
    const taskPath = path.join(this.tasksBasePath, `task-${taskId}`);
    const metadataPath = path.join(taskPath, '.task.json');
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    return true;
  }
  
  private generateTaskName(repositories: Array<{ name: string }>): string {
    // Create a timestamp suffix for uniqueness (e.g., "1230" for 12:30 PM)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    }).replace(':', '');
    
    if (repositories.length === 0) {
      return `task-${timeStr}`;
    } else if (repositories.length === 1) {
      return `${repositories[0].name}-${timeStr}`;
    } else if (repositories.length === 2) {
      return `${repositories[0].name}-${repositories[1].name}-${timeStr}`;
    } else {
      return `${repositories[0].name}-and-${repositories.length - 1}-more-${timeStr}`;
    }
  }
  
  private saveTaskMetadata(task: Task): void {
    const metadataPath = path.join(task.worktreeBasePath, '.task.json');
    const metadata = {
      id: task.id,
      name: task.name,
      status: task.status,
      repositories: task.repositories.map(r => ({
        name: r.name,
        fullName: r.fullName,
        taskBranch: r.taskBranch
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
  
  public getTasksBasePath(): string {
    return this.tasksBasePath;
  }
}