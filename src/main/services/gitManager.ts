import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { TaskRepository, WorktreeProgress } from '../../shared/types/tasks';
import { authService } from './auth';

export class GitManager {
  private static instance: GitManager;
  private gitBasePath: string;
  
  private constructor() {
    // Base path for all git repos (separate from worktrees)
    this.gitBasePath = path.join(app.getPath('userData'), 'git-repos');
    this.ensureGitDirectory();
  }
  
  public static getInstance(): GitManager {
    if (!GitManager.instance) {
      GitManager.instance = new GitManager();
    }
    return GitManager.instance;
  }
  
  private ensureGitDirectory(): void {
    if (!fs.existsSync(this.gitBasePath)) {
      fs.mkdirSync(this.gitBasePath, { recursive: true });
    }
  }
  
  private getRepoBasePath(fullName: string): string {
    // Convert org/repo to org-repo for filesystem
    const safeName = fullName.replace('/', '-');
    return path.join(this.gitBasePath, safeName);
  }
  
  private async ensureRepoCloned(
    fullName: string,
    installationId: number,
    onProgress?: (progress: WorktreeProgress) => void
  ): Promise<string> {
    const repoPath = this.getRepoBasePath(fullName);
    
    // Get installation token first (we'll need it either way)
    const token = await authService.getInstallationToken(installationId);
    if (!token) {
      throw new Error('Failed to get installation token');
    }
    
    // Check if it's a valid git repository
    const isValidRepo = fs.existsSync(path.join(repoPath, '.git', 'config')) || 
                       fs.existsSync(path.join(repoPath, 'config'));
    
    if (isValidRepo) {
      // Repo already exists, fetch latest
      onProgress?.({
        taskId: '',
        repositoryId: 0,
        status: 'checking-out',
        message: 'Fetching latest changes...'
      });
      
      try {
        const git: SimpleGit = simpleGit(repoPath);
        
        // Ensure we have the latest remote info
        await git.remote(['set-url', 'origin', `https://x-access-token:${token}@github.com/${fullName}.git`]);
        await git.fetch(['--all', '--tags']);
        
        // Verify we have remote branches
        const branches = await git.branch(['-r']);
        if (branches.all.length === 0) {
          throw new Error('No remote branches found, need to reclone');
        }
        
        console.log('Using existing repo with branches:', branches.all);
        return repoPath;
      } catch (error) {
        console.error('Failed to fetch or invalid repo, will reclone:', error);
        // Remove corrupted repo and continue to clone
        fs.rmSync(repoPath, { recursive: true, force: true });
      }
    } else if (fs.existsSync(repoPath)) {
      // Directory exists but is not a git repo, remove it
      console.log('Removing non-git directory:', repoPath);
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
    
    // Need to clone the repo
    onProgress?.({
      taskId: '',
      repositoryId: 0,
      status: 'cloning',
      message: 'Cloning repository...'
    });
    
    // Clone with token authentication (token already retrieved above)
    const cloneUrl = `https://x-access-token:${token}@github.com/${fullName}.git`;
    
    const options: Partial<SimpleGitOptions> = {
      progress({ method, stage, progress }) {
        if (method === 'clone') {
          onProgress?.({
            taskId: '',
            repositoryId: 0,
            status: 'cloning',
            progress: progress,
            message: `Cloning: ${progress}%`
          });
        }
      }
    };
    
    const git: SimpleGit = simpleGit(options);
    
    // Clone repository
    await git.clone(cloneUrl, repoPath);
    
    // Set up proper remote tracking
    const repoGit = simpleGit(repoPath);
    
    // Configure git to fetch all branches
    await repoGit.addConfig('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    
    // Fetch all branches and tags
    await repoGit.fetch(['--all', '--tags']);
    
    // List remote branches to verify
    const branches = await repoGit.branch(['-r']);
    console.log('Available remote branches after clone:', branches.all);
    
    return repoPath;
  }
  
  public async setupWorktree(
    taskRepo: TaskRepository,
    taskId: string,
    onProgress?: (progress: WorktreeProgress) => void
  ): Promise<void> {
    try {
      // Ensure the base repo is cloned
      const baseRepoPath = await this.ensureRepoCloned(
        taskRepo.fullName,
        taskRepo.installationId,
        (progress) => onProgress?.({ ...progress, taskId, repositoryId: taskRepo.id })
      );
      
      // Create worktree
      onProgress?.({
        taskId,
        repositoryId: taskRepo.id,
        status: 'creating-worktree',
        message: 'Creating worktree...'
      });
      
      const git: SimpleGit = simpleGit(baseRepoPath);
      
      // Check if worktree already exists
      const worktrees = await git.raw(['worktree', 'list']);
      if (worktrees.includes(taskRepo.worktreePath)) {
        // Worktree exists, just ensure we're on the right branch
        const worktreeGit = simpleGit(taskRepo.worktreePath);
        await worktreeGit.checkout(taskRepo.taskBranch);
      } else {
        // Get the actual default branch from remote
        let baseBranch = taskRepo.originalBranch || 'main';
        
        try {
          // List all remote branches
          const remoteBranches = await git.branch(['-r']);
          const remoteBranchList = remoteBranches.all;
          console.log('Remote branches available:', remoteBranchList);
          
          // Clean branch names (remove 'origin/' prefix for comparison)
          const availableBranches = remoteBranchList
            .filter(b => b.startsWith('origin/'))
            .map(b => b.replace('origin/', ''));
          
          // Check if requested branch exists
          if (!availableBranches.includes(baseBranch)) {
            // Try common defaults
            if (availableBranches.includes('master')) {
              baseBranch = 'master';
            } else if (availableBranches.includes('main')) {
              baseBranch = 'main';
            } else if (availableBranches.length > 0) {
              // Use the first available branch
              baseBranch = availableBranches[0];
            } else {
              throw new Error('No remote branches found');
            }
            console.log(`Branch '${taskRepo.originalBranch}' not found. Using '${baseBranch}' instead.`);
          }
        } catch (error) {
          console.error('Failed to get remote branches:', error);
          // Try to continue with the original branch
        }
        
        // Create new worktree with new branch
        try {
          // Try to create worktree with new branch
          await git.raw([
            'worktree',
            'add',
            '-b',
            taskRepo.taskBranch,
            taskRepo.worktreePath,
            `origin/${baseBranch}`
          ]);
        } catch (error) {
          console.log('Worktree creation error:', error.message);
          
          // Handle various error cases
          if (error.message?.includes('already exists')) {
            // Branch already exists, try to use it
            try {
              await git.raw([
                'worktree',
                'add',
                taskRepo.worktreePath,
                taskRepo.taskBranch
              ]);
            } catch (innerError) {
              if (innerError.message?.includes('already used by worktree')) {
                // Worktree already exists for this branch, remove it first
                console.log(`Branch ${taskRepo.taskBranch} already has a worktree, removing old one...`);
                
                // List worktrees to find the old one
                const worktreeList = await git.raw(['worktree', 'list', '--porcelain']);
                const lines = worktreeList.split('\n');
                
                // Find the worktree path for this branch
                let oldWorktreePath: string | null = null;
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].startsWith('worktree ') && i + 1 < lines.length) {
                    const wtPath = lines[i].substring(9); // Remove 'worktree ' prefix
                    const branchLine = lines[i + 2]; // Branch is 2 lines after worktree
                    if (branchLine && branchLine.includes(taskRepo.taskBranch)) {
                      oldWorktreePath = wtPath;
                      break;
                    }
                  }
                }
                
                if (oldWorktreePath && oldWorktreePath !== taskRepo.worktreePath) {
                  // Remove the old worktree
                  await git.raw(['worktree', 'remove', oldWorktreePath, '--force']);
                }
                
                // Now try to add the worktree again
                await git.raw([
                  'worktree',
                  'add',
                  taskRepo.worktreePath,
                  taskRepo.taskBranch
                ]);
              } else {
                throw innerError;
              }
            }
          } else if (error.message?.includes('already used by worktree')) {
            // This shouldn't happen with unique branch names, but handle it anyway
            console.error(`Branch ${taskRepo.taskBranch} is already used by another worktree`);
            throw new Error(`Branch name collision: ${taskRepo.taskBranch}. Please try creating the task again.`);
          } else {
            throw error;
          }
        }
      }
      
      // Set up remote tracking (using the base branch we actually used)
      try {
        const worktreeGit = simpleGit(taskRepo.worktreePath);
        // Get the current branch's upstream if it was created from a remote branch
        const branches = await git.branch(['-r']);
        const remoteBranch = branches.all.find(b => 
          b.includes(taskRepo.originalBranch) || b.includes('master') || b.includes('main')
        );
        
        if (remoteBranch) {
          const upstreamBranch = remoteBranch.replace('origin/', '');
          await worktreeGit.branch(['--set-upstream-to', `origin/${upstreamBranch}`, taskRepo.taskBranch]);
        }
      } catch (error) {
        console.warn('Could not set up remote tracking:', error);
        // Non-critical error, continue
      }
      
      onProgress?.({
        taskId,
        repositoryId: taskRepo.id,
        status: 'ready',
        message: 'Worktree ready'
      });
      
    } catch (error) {
      onProgress?.({
        taskId,
        repositoryId: taskRepo.id,
        status: 'error',
        message: error.message || 'Failed to set up worktree'
      });
      throw error;
    }
  }
  
  public async removeWorktree(worktreePath: string): Promise<void> {
    if (!fs.existsSync(worktreePath)) {
      return;
    }
    
    // Find the base repo for this worktree
    const git: SimpleGit = simpleGit();
    try {
      // Get the git directory from the worktree
      const gitDir = await git.cwd(worktreePath).revparse(['--git-dir']);
      const baseRepoPath = path.dirname(path.dirname(gitDir));
      
      const baseGit: SimpleGit = simpleGit(baseRepoPath);
      await baseGit.raw(['worktree', 'remove', worktreePath, '--force']);
    } catch (error) {
      // If git operations fail, try manual cleanup
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
    }
  }
  
  public async getWorktreeStatus(worktreePath: string): Promise<any> {
    if (!fs.existsSync(worktreePath)) {
      return null;
    }
    
    const git: SimpleGit = simpleGit(worktreePath);
    const status = await git.status();
    return status;
  }
  
  public async commitChanges(
    worktreePath: string,
    message: string
  ): Promise<void> {
    const git: SimpleGit = simpleGit(worktreePath);
    await git.add('.');
    await git.commit(message);
  }
  
  public async pushChanges(
    worktreePath: string,
    installationId: number,
    fullName: string
  ): Promise<void> {
    // Get fresh token for push
    const token = await authService.getInstallationToken(installationId);
    if (!token) {
      throw new Error('Failed to get installation token for push');
    }
    
    const git: SimpleGit = simpleGit(worktreePath);
    
    // Set remote URL with token
    const pushUrl = `https://x-access-token:${token}@github.com/${fullName}.git`;
    await git.remote(['set-url', 'origin', pushUrl]);
    
    // Push current branch
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    await git.push(['origin', branch]);
    
    // Reset remote URL to remove token
    const cleanUrl = `https://github.com/${fullName}.git`;
    await git.remote(['set-url', 'origin', cleanUrl]);
  }
  
  public async createPullRequest(
    taskRepo: TaskRepository,
    title: string,
    body: string
  ): Promise<any> {
    // This would integrate with GitHub API to create PR
    // For now, returning placeholder
    return {
      url: `https://github.com/${taskRepo.fullName}/pull/new/${taskRepo.taskBranch}`,
      number: null
    };
  }
}