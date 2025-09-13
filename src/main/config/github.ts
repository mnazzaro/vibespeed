import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

import { GitHubAppConfig } from '../../shared/types/auth';

// Load environment variables from a suitable location in both dev and packaged builds
(() => {
  // Prevent double-loading
  if (process.env.__VIBESPEED_ENV_LOADED === '1') return;

  const candidates: string[] = [];
  if (process.env.VIBESPEED_ENV_PATH) {
    candidates.push(process.env.VIBESPEED_ENV_PATH);
  }
  try {
    // In packaged apps, process.resourcesPath points to .../Contents/Resources/
    // Place a .env.production there via extraResource so it's discoverable
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, '.env.production'));
    }
  } catch {
    // ignore if process.resourcesPath is not available
  }
  // Fallback to project .env in development
  candidates.push(path.resolve(process.cwd(), '.env'));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        process.env.__VIBESPEED_ENV_LOADED = '1';
        break;
      }
    } catch {
      // continue to next candidate
    }
  }
})();

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class GitHubConfig {
  private static instance: GitHubConfig;
  private config: GitHubAppConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): GitHubConfig {
    if (!GitHubConfig.instance) {
      GitHubConfig.instance = new GitHubConfig();
    }
    return GitHubConfig.instance;
  }

  private loadConfiguration(): GitHubAppConfig {
    const appId = process.env.GITHUB_APP_ID;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!appId) {
      throw new ConfigurationError('GITHUB_APP_ID is required');
    }

    if (!clientId) {
      throw new ConfigurationError('GITHUB_CLIENT_ID is required');
    }

    if (!clientSecret) {
      throw new ConfigurationError('GITHUB_CLIENT_SECRET is required');
    }

    const privateKey = this.loadPrivateKey();

    return {
      appId: parseInt(appId, 10),
      privateKey,
      clientId,
      clientSecret,
      webhookSecret,
    };
  }

  private loadPrivateKey(): string {
    const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
    const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY;

    if (privateKeyBase64) {
      try {
        return Buffer.from(privateKeyBase64, 'base64').toString('utf8');
      } catch (error) {
        throw new ConfigurationError(`Failed to decode base64 private key. Error: ${error.message}`);
      }
    } else if (privateKeyPath) {
      try {
        const keyPath = path.resolve(privateKeyPath);
        return fs.readFileSync(keyPath, 'utf8');
      } catch (error) {
        throw new ConfigurationError(
          `Failed to load private key from path: ${privateKeyPath}. Error: ${error.message}`
        );
      }
    } else {
      throw new ConfigurationError('Either GITHUB_PRIVATE_KEY_PATH or GITHUB_PRIVATE_KEY must be set');
    }
  }

  public getConfig(): GitHubAppConfig {
    return { ...this.config };
  }

  public getAppId(): number {
    return this.config.appId;
  }

  public getClientId(): string {
    return this.config.clientId;
  }

  public getClientSecret(): string {
    return this.config.clientSecret;
  }

  public getPrivateKey(): string {
    return this.config.privateKey;
  }

  public getWebhookSecret(): string | undefined {
    return this.config.webhookSecret;
  }

  public getRedirectUri(): string {
    return process.env.GITHUB_REDIRECT_URI || 'vibespeed://auth-callback';
  }

  public getAppName(): string {
    const appName = process.env.GITHUB_APP_NAME;
    if (!appName) {
      throw new ConfigurationError('GITHUB_APP_NAME is required');
    }
    return appName;
  }

  public getInstallationUrl(): string {
    return `https://github.com/apps/${this.getAppName()}/installations/new`;
  }

  public getOAuthBaseUrl(): string {
    return 'https://github.com/login/oauth';
  }

  public getApiBaseUrl(): string {
    return 'https://api.github.com';
  }

  public isProduction(): boolean {
    return process.env.APP_ENV === 'production';
  }

  public isDebugMode(): boolean {
    return process.env.APP_DEBUG === 'true';
  }

  public getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      if (this.isProduction()) {
        throw new ConfigurationError('SESSION_SECRET is required in production');
      }
      return 'development-secret-change-me';
    }
    return secret;
  }
}

export const githubConfig = GitHubConfig.getInstance();
