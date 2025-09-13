import { Octokit } from '@octokit/rest';

import { GitHubRepository } from '../../shared/types/auth';

import { authService } from './auth';
import { tokenManager } from './tokenManager';

export type CreateRepositoryOptions = Parameters<Octokit['repos']['createForAuthenticatedUser']>[0];

export interface CreateIssueOptions {
  title: string;
  body?: string;
  assignees?: string[];
  milestone?: number;
  labels?: string[];
}

export interface CreatePullRequestOptions {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

export class GitHubService {
  private static instance: GitHubService;

  private constructor() {}

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  private async getOctokit(installationId?: number): Promise<Octokit> {
    if (installationId) {
      // Use installation token
      const token = await authService.getCurrentToken();
      if (!token) {
        throw new Error('No installation token available');
      }
      return new Octokit({ auth: token.token });
    } else {
      // Use user token
      const userToken = tokenManager.getUserToken();
      if (!userToken) {
        throw new Error('Not authenticated');
      }
      return new Octokit({ auth: userToken });
    }
  }

  // Repository operations
  public async getRepository(owner: string, repo: string, installationId?: number): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.get({ owner, repo });
    return data;
  }

  public async listUserRepositories(): Promise<GitHubRepository[]> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
    });

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      owner: {
        login: repo.owner.login,
        id: repo.owner.id,
        avatar_url: repo.owner.avatar_url,
        type: repo.owner.type,
      },
      description: repo.description,
      fork: repo.fork,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      homepage: repo.homepage,
      language: repo.language,
      archived: repo.archived,
      disabled: repo.disabled,
      visibility: repo.visibility as 'public' | 'private' | 'internal',
      default_branch: repo.default_branch,
      permissions: repo.permissions,
    }));
  }

  public async createRepository(options: CreateRepositoryOptions): Promise<GitHubRepository> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.createForAuthenticatedUser(options);

    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      private: data.private,
      owner: {
        login: data.owner.login,
        id: data.owner.id,
        avatar_url: data.owner.avatar_url,
        type: data.owner.type,
      },
      description: data.description,
      fork: data.fork,
      created_at: data.created_at,
      updated_at: data.updated_at,
      pushed_at: data.pushed_at,
      homepage: data.homepage,
      language: data.language,
      archived: data.archived,
      disabled: data.disabled,
      visibility: data.visibility as 'public' | 'private' | 'internal',
      default_branch: data.default_branch,
    };
  }

  // Branch operations
  public async listBranches(owner: string, repo: string, installationId?: number): Promise<any[]> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });
    return data;
  }

  public async getBranch(owner: string, repo: string, branch: string, installationId?: number): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.getBranch({
      owner,
      repo,
      branch,
    });
    return data;
  }

  // Commit operations
  public async listCommits(owner: string, repo: string, options?: any, installationId?: number): Promise<any[]> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  public async getCommit(owner: string, repo: string, ref: string, installationId?: number): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.getCommit({
      owner,
      repo,
      ref,
    });
    return data;
  }

  // File operations
  public async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    installationId?: number
  ): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    return data;
  }

  public async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    content: string,
    sha?: string,
    branch?: string,
    installationId?: number
  ): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    });
    return data;
  }

  // Issue operations
  public async listIssues(owner: string, repo: string, options?: any, installationId?: number): Promise<any[]> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  public async createIssue(
    owner: string,
    repo: string,
    options: CreateIssueOptions,
    installationId?: number
  ): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.issues.create({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  // Pull request operations
  public async listPullRequests(owner: string, repo: string, options?: any, installationId?: number): Promise<any[]> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  public async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePullRequestOptions,
    installationId?: number
  ): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      ...options,
    });
    return data;
  }

  // Organization operations
  public async listUserOrganizations(): Promise<any[]> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.orgs.listForAuthenticatedUser();
    return data;
  }

  public async getOrganization(org: string): Promise<any> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.orgs.get({ org });
    return data;
  }

  // Search operations
  public async searchRepositories(query: string, options?: any): Promise<any> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.search.repos({
      q: query,
      ...options,
    });
    return data;
  }

  public async searchCode(query: string, options?: any): Promise<any> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.search.code({
      q: query,
      ...options,
    });
    return data;
  }

  public async searchIssues(query: string, options?: any): Promise<any> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.search.issuesAndPullRequests({
      q: query,
      ...options,
    });
    return data;
  }

  // User operations
  public async getUser(username?: string): Promise<any> {
    const octokit = await this.getOctokit();
    if (username) {
      const { data } = await octokit.users.getByUsername({ username });
      return data;
    } else {
      const { data } = await octokit.users.getAuthenticated();
      return data;
    }
  }

  public async listUserFollowers(username?: string): Promise<any[]> {
    const octokit = await this.getOctokit();
    if (username) {
      const { data } = await octokit.users.listFollowersForUser({ username });
      return data;
    } else {
      const { data } = await octokit.users.listFollowersForAuthenticatedUser();
      return data;
    }
  }

  // Webhook operations (for GitHub Apps)
  public async createWebhook(
    owner: string,
    repo: string,
    config: any,
    events: string[],
    installationId?: number
  ): Promise<any> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.createWebhook({
      owner,
      repo,
      config,
      events,
    });
    return data;
  }

  public async listWebhooks(owner: string, repo: string, installationId?: number): Promise<any[]> {
    const octokit = await this.getOctokit(installationId);
    const { data } = await octokit.repos.listWebhooks({
      owner,
      repo,
    });
    return data;
  }
}

export const githubService = GitHubService.getInstance();
