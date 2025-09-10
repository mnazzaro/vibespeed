import { safeStorage } from 'electron';
import Store from 'electron-store';
import { 
  AuthToken, 
  SecureStorageData, 
  TokenRefreshResult,
  GitHubInstallation,
  UserProfile 
} from '../../shared/types/auth';

interface StoreSchema {
  encryptedData?: string;
  lastUpdated?: number;
}

interface StoreInstance {
  get(key: 'encryptedData'): string | undefined;
  get(key: 'lastUpdated'): number | undefined;
  set(key: 'encryptedData', value: string): void;
  set(key: 'lastUpdated', value: number): void;
  clear(): void;
}

export class TokenManager {
  private static instance: TokenManager;
  private store: StoreInstance;
  private memoryCache: Map<string, AuthToken>;
  private refreshTimers: Map<number, NodeJS.Timeout>;
  
  private constructor() {
    this.store = new Store<StoreSchema>({
      name: 'vibespeed-auth',
      encryptionKey: this.getEncryptionKey(),
    }) as unknown as StoreInstance;
    this.memoryCache = new Map();
    this.refreshTimers = new Map();
  }
  
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  private getEncryptionKey(): string | undefined {
    // Use electron-store's built-in encryption
    // The key is derived from the app's name and machine ID
    return undefined; // Let electron-store handle it
  }
  
  private encrypt(data: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Encryption not available, storing in plain text (development mode)');
      return data;
    }
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = safeStorage.encryptString(data);
    return encrypted.toString('base64');
  }
  
  private decrypt(encryptedData: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      return encryptedData;
    }
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw new Error('Failed to decrypt stored credentials');
    }
  }
  
  private getStorageData(): SecureStorageData {
    try {
      const encryptedData = this.store.get('encryptedData');
      if (!encryptedData) {
        return {};
      }
      const decrypted = this.decrypt(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load storage data:', error);
      return {};
    }
  }
  
  private saveStorageData(data: SecureStorageData): void {
    try {
      const json = JSON.stringify(data);
      const encrypted = this.encrypt(json);
      this.store.set('encryptedData', encrypted);
      this.store.set('lastUpdated', Date.now());
    } catch (error) {
      console.error('Failed to save storage data:', error);
      throw new Error('Failed to save credentials');
    }
  }
  
  public async saveUserToken(token: string): Promise<void> {
    const data = this.getStorageData();
    data.githubApp = data.githubApp || {};
    data.githubApp.userToken = token;
    this.saveStorageData(data);
  }
  
  public getUserToken(): string | null {
    const data = this.getStorageData();
    return data.githubApp?.userToken || null;
  }
  
  public async saveInstallationToken(
    installationId: number, 
    token: AuthToken
  ): Promise<void> {
    const cacheKey = `installation_${installationId}`;
    
    // Save to memory cache
    this.memoryCache.set(cacheKey, token);
    
    // Save to persistent storage
    const data = this.getStorageData();
    data.githubApp = data.githubApp || {};
    data.githubApp.tokenCache = data.githubApp.tokenCache || {};
    data.githubApp.tokenCache[installationId] = token;
    this.saveStorageData(data);
    
    // Schedule refresh before expiration
    this.scheduleTokenRefresh(installationId, token.expiresAt);
  }
  
  public getInstallationToken(installationId: number): AuthToken | null {
    const cacheKey = `installation_${installationId}`;
    
    // Check memory cache first
    const cachedToken = this.memoryCache.get(cacheKey);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      return cachedToken;
    }
    
    // Check persistent storage
    const data = this.getStorageData();
    const token = data.githubApp?.tokenCache?.[installationId];
    
    if (token && this.isTokenValid(token)) {
      // Restore to memory cache
      this.memoryCache.set(cacheKey, token);
      return token;
    }
    
    return null;
  }
  
  private isTokenValid(token: AuthToken): boolean {
    const expiryTime = new Date(token.expiresAt).getTime();
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return expiryTime > (now + bufferTime);
  }
  
  private scheduleTokenRefresh(installationId: number, expiresAt: Date): void {
    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(installationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const refreshTime = expiryTime - (10 * 60 * 1000); // Refresh 10 minutes before expiry
    const delay = Math.max(0, refreshTime - now);
    
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.emit('token-refresh-needed', installationId);
      }, delay);
      
      this.refreshTimers.set(installationId, timer);
    }
  }
  
  public async saveInstallations(installations: GitHubInstallation[]): Promise<void> {
    const data = this.getStorageData();
    data.githubApp = data.githubApp || {};
    data.githubApp.installations = installations;
    this.saveStorageData(data);
  }
  
  public getInstallations(): GitHubInstallation[] {
    const data = this.getStorageData();
    return data.githubApp?.installations || [];
  }
  
  public async setCurrentInstallation(installationId: number): Promise<void> {
    const data = this.getStorageData();
    data.githubApp = data.githubApp || {};
    data.githubApp.currentInstallationId = installationId;
    this.saveStorageData(data);
  }
  
  public getCurrentInstallationId(): number | null {
    const data = this.getStorageData();
    return data.githubApp?.currentInstallationId || null;
  }
  
  public async saveUser(user: UserProfile): Promise<void> {
    const data = this.getStorageData();
    data.user = user;
    this.saveStorageData(data);
  }
  
  public getUser(): UserProfile | null {
    const data = this.getStorageData();
    return data.user || null;
  }
  
  public async clearAll(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear all refresh timers
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers.clear();
    
    // Clear persistent storage
    this.store.clear();
  }
  
  public async clearInstallationToken(installationId: number): Promise<void> {
    const cacheKey = `installation_${installationId}`;
    this.memoryCache.delete(cacheKey);
    
    const timer = this.refreshTimers.get(installationId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(installationId);
    }
    
    const data = this.getStorageData();
    if (data.githubApp?.tokenCache) {
      delete data.githubApp.tokenCache[installationId];
      this.saveStorageData(data);
    }
  }
  
  // EventEmitter functionality (simplified)
  private listeners: Map<string, Function[]> = new Map();
  
  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }
  
  public on(event: string, handler: Function): void {
    const handlers = this.listeners.get(event) || [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }
  
  public off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.listeners.set(event, handlers);
    }
  }
}

export const tokenManager = TokenManager.getInstance();