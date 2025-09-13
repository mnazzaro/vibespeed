import { EventEmitter } from 'events';
import { URL } from 'url';

import { app, BrowserWindow } from 'electron';

export interface DeepLinkData {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

class DeepLinkHandler extends EventEmitter {
  private static instance: DeepLinkHandler;
  private protocol = 'vibespeed';
  private isRegistered = false;

  private constructor() {
    super();
  }

  public static getInstance(): DeepLinkHandler {
    if (!DeepLinkHandler.instance) {
      DeepLinkHandler.instance = new DeepLinkHandler();
    }
    return DeepLinkHandler.instance;
  }

  public initialize(): void {
    if (this.isRegistered) {
      return;
    }

    // Register protocol for production
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(this.protocol, process.execPath, [process.argv[1]]);
      }
    } else {
      app.setAsDefaultProtocolClient(this.protocol);
    }

    // Handle protocol on Windows
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
    } else {
      app.on('second-instance', (_event, commandLine, _workingDirectory) => {
        const url = this.findDeepLink(commandLine);
        if (url) {
          this.handleDeepLink(url);
        }

        // Focus the main window if it exists
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
        }
      });
    }

    // Handle protocol on macOS
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.handleDeepLink(url);
    });

    // Handle initial protocol if app was opened with one
    if (process.platform === 'win32' && process.argv.length >= 2) {
      const url = this.findDeepLink(process.argv);
      if (url) {
        app.whenReady().then(() => {
          this.handleDeepLink(url);
        });
      }
    }

    this.isRegistered = true;
  }

  private findDeepLink(args: string[]): string | null {
    const prefix = `${this.protocol}://`;
    const url = args.find((arg) => arg.startsWith(prefix));
    return url || null;
  }

  private handleDeepLink(url: string): void {
    try {
      const parsed = new URL(url);

      // Check if this is an auth callback
      if (parsed.hostname === 'auth-callback') {
        const params = this.parseAuthParams(parsed.searchParams);
        this.emit('auth-callback', params);

        // Log for debugging
        if (process.env.APP_DEBUG === 'true') {
          console.log('Deep link auth callback received:', {
            hasCode: !!params.code,
            hasState: !!params.state,
            hasError: !!params.error,
          });
        }
      } else {
        // Handle other deep link types if needed
        this.emit('deep-link', { url, parsed });
      }

      // Focus the app window
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    } catch (error) {
      console.error('Failed to handle deep link:', error);
      this.emit('error', error);
    }
  }

  private parseAuthParams(searchParams: URLSearchParams): DeepLinkData {
    return {
      code: searchParams.get('code') || undefined,
      state: searchParams.get('state') || undefined,
      error: searchParams.get('error') || undefined,
      error_description: searchParams.get('error_description') || undefined,
      error_uri: searchParams.get('error_uri') || undefined,
    };
  }

  public waitForAuthCallback(timeout = 300000): Promise<DeepLinkData> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('auth-callback', handleCallback);
        reject(new Error('Authentication timeout - no callback received'));
      }, timeout);

      const handleCallback = (data: DeepLinkData) => {
        clearTimeout(timer);

        if (data.error) {
          reject(new Error(`Authentication failed: ${data.error_description || data.error}`));
        } else if (!data.code) {
          reject(new Error('No authorization code received'));
        } else {
          resolve(data);
        }
      };

      this.once('auth-callback', handleCallback);
    });
  }

  public isProtocolRegistered(): boolean {
    return this.isRegistered;
  }

  public getProtocol(): string {
    return this.protocol;
  }

  public getCallbackUrl(): string {
    return `${this.protocol}://auth-callback`;
  }
}

export const deepLinkHandler = DeepLinkHandler.getInstance();
