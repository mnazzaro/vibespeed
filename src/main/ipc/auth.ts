import { ipcMain, BrowserWindow, shell } from 'electron';
import { authService } from '../services/auth';
import { deepLinkHandler, DeepLinkData } from '../handlers/deepLink';
import { 
  AuthResponse, 
  GitHubInstallation, 
  GitHubRepository,
  AuthToken,
  UserProfile
} from '../../shared/types/auth';

export class AuthIPCHandler {
  private static instance: AuthIPCHandler;
  private mainWindow: BrowserWindow | null = null;
  
  private constructor() {
    this.setupHandlers();
    this.setupDeepLinkHandler();
  }
  
  public static getInstance(): AuthIPCHandler {
    if (!AuthIPCHandler.instance) {
      AuthIPCHandler.instance = new AuthIPCHandler();
    }
    return AuthIPCHandler.instance;
  }
  
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }
  
  private setupHandlers(): void {
    // Start OAuth flow
    ipcMain.handle('auth:start-flow', async () => {
      try {
        const { authUrl, state } = await authService.startOAuthFlow();
        
        // Open auth URL in default browser
        await authService.openAuthInBrowser();
        
        // Wait for callback
        const callbackPromise = deepLinkHandler.waitForAuthCallback();
        
        return { 
          success: true, 
          authUrl,
          state,
          waitingForCallback: true 
        };
      } catch (error) {
        console.error('Failed to start auth flow:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to start authentication' 
        };
      }
    });
    
    // Handle OAuth callback
    ipcMain.handle('auth:handle-callback', async (event, code: string, state: string) => {
      try {
        const response = await authService.handleOAuthCallback(code, state);
        
        // Notify renderer of auth state change
        if (this.mainWindow && response.success) {
          this.mainWindow.webContents.send('auth:state-changed', {
            isAuthenticated: true,
            user: response.data?.user,
            installations: response.data?.installations,
          });
        }
        
        return response;
      } catch (error) {
        console.error('Failed to handle callback:', error);
        return {
          success: false,
          error: error.message || 'Failed to complete authentication',
        };
      }
    });
    
    // Get user installations
    ipcMain.handle('auth:get-installations', async (): Promise<GitHubInstallation[]> => {
      try {
        return authService.getInstallations();
      } catch (error) {
        console.error('Failed to get installations:', error);
        return [];
      }
    });
    
    // Select an installation
    ipcMain.handle('auth:select-installation', async (event, installationId: number): Promise<AuthResponse> => {
      try {
        const response = await authService.selectInstallation(installationId);
        
        // Notify renderer of installation change
        if (this.mainWindow && response.success) {
          this.mainWindow.webContents.send('auth:installation-selected', {
            installationId,
            token: response.data?.token,
          });
        }
        
        return response;
      } catch (error) {
        console.error('Failed to select installation:', error);
        return {
          success: false,
          error: error.message || 'Failed to select installation',
        };
      }
    });
    
    // Get current token
    ipcMain.handle('auth:get-current-token', async (): Promise<AuthToken | null> => {
      try {
        return await authService.getCurrentToken();
      } catch (error) {
        console.error('Failed to get current token:', error);
        return null;
      }
    });
    
    // Refresh token
    ipcMain.handle('auth:refresh-token', async (): Promise<AuthResponse> => {
      try {
        return await authService.refreshUserData();
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return {
          success: false,
          error: error.message || 'Failed to refresh authentication',
        };
      }
    });
    
    // Logout
    ipcMain.handle('auth:logout', async (): Promise<void> => {
      try {
        await authService.logout();
        
        // Notify renderer of logout
        if (this.mainWindow) {
          this.mainWindow.webContents.send('auth:state-changed', {
            isAuthenticated: false,
            user: null,
            installations: [],
          });
        }
      } catch (error) {
        console.error('Failed to logout:', error);
        throw error;
      }
    });
    
    // Get current user
    ipcMain.handle('auth:get-user', async (): Promise<UserProfile | null> => {
      try {
        return await authService.getCurrentUser();
      } catch (error) {
        console.error('Failed to get user:', error);
        return null;
      }
    });
    
    // Get repositories for an installation
    ipcMain.handle('auth:get-repositories', async (event, installationId: number): Promise<GitHubRepository[]> => {
      try {
        return await authService.getRepositories(installationId);
      } catch (error) {
        console.error('Failed to get repositories:', error);
        return [];
      }
    });
    
    // Check authentication status
    ipcMain.handle('auth:is-authenticated', async (): Promise<boolean> => {
      try {
        return authService.isAuthenticated();
      } catch (error) {
        console.error('Failed to check auth status:', error);
        return false;
      }
    });
    
    // Get complete auth state
    ipcMain.handle('auth:get-state', async () => {
      try {
        const isAuthenticated = authService.isAuthenticated();
        const user = await authService.getCurrentUser();
        const installations = authService.getInstallations();
        const token = await authService.getCurrentToken();
        
        return {
          isAuthenticated,
          user,
          installations,
          currentInstallation: token?.installation || null,
          token,
        };
      } catch (error) {
        console.error('Failed to get auth state:', error);
        return {
          isAuthenticated: false,
          user: null,
          installations: [],
          currentInstallation: null,
          token: null,
        };
      }
    });
    
    // Open external URL in system browser
    ipcMain.handle('app:open-external', async (event, url: string): Promise<void> => {
      try {
        await shell.openExternal(url);
      } catch (error) {
        console.error('Failed to open external URL:', error);
        throw error;
      }
    });
    
    // Get GitHub App installation URL
    ipcMain.handle('app:get-installation-url', async (): Promise<string> => {
      try {
        const { githubConfig } = await import('../config/github');
        return githubConfig.getInstallationUrl();
      } catch (error) {
        console.error('Failed to get installation URL:', error);
        // Fallback to generic installations page if app name not configured
        return 'https://github.com/settings/installations';
      }
    });
  }
  
  private setupDeepLinkHandler(): void {
    // Handle auth callbacks from deep links
    deepLinkHandler.on('auth-callback', async (data: DeepLinkData) => {
      if (data.code && data.state) {
        try {
          const response = await authService.handleOAuthCallback(data.code, data.state);
          
          // Notify renderer of completion
          if (this.mainWindow) {
            this.mainWindow.webContents.send('auth:callback-received', response);
            
            if (response.success) {
              this.mainWindow.webContents.send('auth:state-changed', {
                isAuthenticated: true,
                user: response.data?.user,
                installations: response.data?.installations,
              });
            }
          }
        } catch (error) {
          console.error('Failed to handle deep link callback:', error);
          
          if (this.mainWindow) {
            this.mainWindow.webContents.send('auth:callback-received', {
              success: false,
              error: error.message || 'Authentication failed',
            });
          }
        }
      } else if (data.error) {
        // Handle error from GitHub
        if (this.mainWindow) {
          this.mainWindow.webContents.send('auth:callback-received', {
            success: false,
            error: data.error_description || data.error,
          });
        }
      }
    });
  }
  
  public initialize(window: BrowserWindow): void {
    this.setMainWindow(window);
    
    // Initialize deep link handler
    deepLinkHandler.initialize();
    
    // Send initial auth state
    window.webContents.on('did-finish-load', async () => {
      const state = await this.getAuthState();
      window.webContents.send('auth:initial-state', state);
    });
  }
  
  private async getAuthState() {
    const isAuthenticated = authService.isAuthenticated();
    const user = await authService.getCurrentUser();
    const installations = authService.getInstallations();
    const token = await authService.getCurrentToken();
    
    return {
      isAuthenticated,
      user,
      installations,
      currentInstallation: token?.installation || null,
      token,
    };
  }
}

export const authIPCHandler = AuthIPCHandler.getInstance();