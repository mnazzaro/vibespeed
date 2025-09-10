import { shell } from 'electron';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { nanoid } from 'nanoid';
import * as crypto from 'crypto';
import { SignJWT } from 'jose';
import { 
  AuthToken, 
  GitHubInstallation, 
  UserProfile,
  OAuthState,
  AuthResponse,
  GitHubRepository
} from '../../shared/types/auth';
import { githubConfig } from '../config/github';
import { tokenManager } from './tokenManager';
import { deepLinkHandler } from '../handlers/deepLink';

export class AuthService {
  private static instance: AuthService;
  private octokit: Octokit | null = null;
  private appOctokit: Octokit | null = null;
  private pendingOAuthState: OAuthState | null = null;
  
  private constructor() {
    this.initializeAppAuth();
    this.setupTokenRefreshHandler();
  }
  
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  private async initializeAppAuth(): Promise<void> {
    try {
      const config = githubConfig.getConfig();
      
      const auth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      
      this.appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.privateKey,
        },
      });
    } catch (error) {
      console.error('Failed to initialize app authentication:', error);
      throw new Error('Failed to initialize GitHub App authentication');
    }
  }
  
  private setupTokenRefreshHandler(): void {
    tokenManager.on('token-refresh-needed', async (installationId: number) => {
      try {
        await this.refreshInstallationToken(installationId);
      } catch (error) {
        console.error(`Failed to refresh token for installation ${installationId}:`, error);
      }
    });
  }
  
  private generatePKCEChallenge(): { verifier: string; challenge: string } {
    const verifier = nanoid(128);
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return { verifier, challenge };
  }
  
  public async startOAuthFlow(): Promise<{ authUrl: string; state: string }> {
    try {
      const state = nanoid(32);
      const { verifier, challenge } = this.generatePKCEChallenge();
      
      // Store OAuth state
      this.pendingOAuthState = {
        state,
        codeVerifier: verifier,
        codeChallenge: challenge,
        createdAt: Date.now(),
      };
      
      const params = new URLSearchParams({
        client_id: githubConfig.getClientId(),
        redirect_uri: githubConfig.getRedirectUri(),
        scope: 'read:user user:email read:org repo',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      
      const authUrl = `${githubConfig.getOAuthBaseUrl()}/authorize?${params}`;
      
      return { authUrl, state };
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      throw new Error('Failed to start authentication flow');
    }
  }
  
  public async openAuthInBrowser(): Promise<void> {
    const { authUrl } = await this.startOAuthFlow();
    await shell.openExternal(authUrl);
  }
  
  public async handleOAuthCallback(code: string, state: string): Promise<AuthResponse> {
    try {
      // Validate state
      if (!this.pendingOAuthState || this.pendingOAuthState.state !== state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }
      
      // Check state expiry (5 minutes)
      const stateAge = Date.now() - this.pendingOAuthState.createdAt;
      if (stateAge > 5 * 60 * 1000) {
        throw new Error('OAuth state expired');
      }
      
      const { codeVerifier } = this.pendingOAuthState;
      
      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);
      
      // Clear pending state
      this.pendingOAuthState = null;
      
      // Save user token
      await tokenManager.saveUserToken(tokenResponse.access_token);
      
      // Initialize user Octokit
      this.octokit = new Octokit({
        auth: tokenResponse.access_token,
      });
      
      // Get user profile
      const user = await this.fetchUserProfile();
      await tokenManager.saveUser(user);
      
      // Get installations
      const installations = await this.fetchUserInstallations();
      await tokenManager.saveInstallations(installations);
      
      return {
        success: true,
        data: {
          user,
          installations,
        },
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }
  
  private async exchangeCodeForToken(
    code: string, 
    codeVerifier: string
  ): Promise<any> {
    const params = new URLSearchParams({
      client_id: githubConfig.getClientId(),
      client_secret: githubConfig.getClientSecret(),
      code,
      redirect_uri: githubConfig.getRedirectUri(),
      code_verifier: codeVerifier,
    });
    
    const response = await fetch(`${githubConfig.getOAuthBaseUrl()}/access_token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Token exchange error: ${data.error_description || data.error}`);
    }
    
    return data;
  }
  
  private async fetchUserProfile(): Promise<UserProfile> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }
    
    const { data } = await this.octokit.users.getAuthenticated();
    
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email: data.email,
      avatar_url: data.avatar_url,
      bio: data.bio,
      company: data.company,
      location: data.location,
      blog: data.blog,
      twitter_username: data.twitter_username,
      public_repos: data.public_repos,
      public_gists: data.public_gists,
      followers: data.followers,
      following: data.following,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
  
  private async fetchUserInstallations(): Promise<GitHubInstallation[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }
    
    const { data } = await this.octokit.apps.listInstallationsForAuthenticatedUser();
    
    return data.installations.map(installation => ({
      id: installation.id,
      account: {
        login: installation.account.login,
        id: installation.account.id,
        avatar_url: installation.account.avatar_url,
        type: installation.account.type as 'User' | 'Organization',
      },
      repository_selection: installation.repository_selection,
      permissions: installation.permissions,
      events: installation.events,
      created_at: installation.created_at,
      updated_at: installation.updated_at,
      single_file_name: installation.single_file_name,
      has_multiple_single_files: installation.has_multiple_single_files,
      single_file_paths: installation.single_file_paths,
      suspended_by: installation.suspended_by,
      suspended_at: installation.suspended_at,
    }));
  }
  
  public async selectInstallation(installationId: number): Promise<AuthResponse> {
    try {
      await tokenManager.setCurrentInstallation(installationId);
      const token = await this.getOrCreateInstallationToken(installationId);
      
      return {
        success: true,
        data: {
          token,
        },
      };
    } catch (error) {
      console.error('Failed to select installation:', error);
      return {
        success: false,
        error: error.message || 'Failed to select installation',
      };
    }
  }
  
  private async getOrCreateInstallationToken(installationId: number): Promise<AuthToken> {
    // Check if we have a valid cached token
    let token = tokenManager.getInstallationToken(installationId);
    
    if (!token) {
      // Create new token
      token = await this.createInstallationToken(installationId);
      await tokenManager.saveInstallationToken(installationId, token);
    }
    
    return token;
  }
  
  private async createInstallationToken(installationId: number): Promise<AuthToken> {
    if (!this.appOctokit) {
      throw new Error('App authentication not initialized');
    }
    
    const { data } = await this.appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });
    
    // Get installation details
    const installation = tokenManager.getInstallations().find(i => i.id === installationId);
    
    return {
      token: data.token,
      expiresAt: new Date(data.expires_at),
      permissions: data.permissions,
      repositories: data.repositories as GitHubRepository[],
      installation,
    };
  }
  
  private async refreshInstallationToken(installationId: number): Promise<AuthToken> {
    const newToken = await this.createInstallationToken(installationId);
    await tokenManager.saveInstallationToken(installationId, newToken);
    return newToken;
  }
  
  public async getInstallationToken(installationId: number): Promise<string | null> {
    try {
      const token = await this.getOrCreateInstallationToken(installationId);
      return token.token;
    } catch (error) {
      console.error('Failed to get installation token:', error);
      return null;
    }
  }
  
  public async getRepositories(installationId: number): Promise<GitHubRepository[]> {
    const token = await this.getOrCreateInstallationToken(installationId);
    
    const installationOctokit = new Octokit({
      auth: token.token,
    });
    
    const { data } = await installationOctokit.apps.listReposAccessibleToInstallation();
    
    return data.repositories.map(repo => ({
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
  
  public async logout(): Promise<void> {
    await tokenManager.clearAll();
    this.octokit = null;
    this.pendingOAuthState = null;
  }
  
  public async getCurrentUser(): Promise<UserProfile | null> {
    return tokenManager.getUser();
  }
  
  public async getCurrentToken(): Promise<AuthToken | null> {
    const installationId = tokenManager.getCurrentInstallationId();
    if (!installationId) {
      return null;
    }
    
    return await this.getOrCreateInstallationToken(installationId);
  }
  
  public isAuthenticated(): boolean {
    return tokenManager.getUserToken() !== null;
  }
  
  public getInstallations(): GitHubInstallation[] {
    return tokenManager.getInstallations();
  }
  
  public async refreshUserData(): Promise<AuthResponse> {
    try {
      const userToken = tokenManager.getUserToken();
      if (!userToken) {
        throw new Error('Not authenticated');
      }
      
      // Reinitialize Octokit
      this.octokit = new Octokit({
        auth: userToken,
      });
      
      // Refresh user profile
      const user = await this.fetchUserProfile();
      await tokenManager.saveUser(user);
      
      // Refresh installations
      const installations = await this.fetchUserInstallations();
      await tokenManager.saveInstallations(installations);
      
      return {
        success: true,
        data: {
          user,
          installations,
        },
      };
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      return {
        success: false,
        error: error.message || 'Failed to refresh user data',
      };
    }
  }
}

export const authService = AuthService.getInstance();