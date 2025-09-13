export interface GitHubAppConfig {
  appId: number;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret?: string;
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    avatar_url: string;
    type: 'User' | 'Organization';
  };
  repository_selection: 'all' | 'selected';
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
  single_file_name?: string | null;
  has_multiple_single_files?: boolean;
  single_file_paths?: string[];
  suspended_by?: {
    login: string;
    id: number;
    avatar_url: string;
  } | null;
  suspended_at?: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  language: string | null;
  archived: boolean;
  disabled: boolean;
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  permissions?: Record<string, string>;
  repositories?: GitHubRepository[];
  installation?: GitHubInstallation;
}

export interface UserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  installations: GitHubInstallation[];
  currentInstallation: GitHubInstallation | null;
  token: AuthToken | null;
  error: string | null;
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAt: number;
}

export interface AuthRequest {
  type: 'login' | 'logout' | 'refresh' | 'selectInstallation';
  installationId?: number;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user?: UserProfile;
    installations?: GitHubInstallation[];
    token?: AuthToken;
  };
  error?: string;
}

export interface IPCAuthChannels {
  'auth:start-flow': () => Promise<{ authUrl: string }>;
  'auth:handle-callback': (code: string, state: string) => Promise<AuthResponse>;
  'auth:get-installations': () => Promise<GitHubInstallation[]>;
  'auth:select-installation': (installationId: number) => Promise<AuthResponse>;
  'auth:get-current-token': () => Promise<AuthToken | null>;
  'auth:refresh-token': () => Promise<AuthResponse>;
  'auth:logout': () => Promise<void>;
  'auth:get-user': () => Promise<UserProfile | null>;
  'auth:get-repositories': (installationId: number) => Promise<GitHubRepository[]>;
}

export interface SecureStorageData {
  githubApp?: {
    userToken?: string;
    installations?: GitHubInstallation[];
    currentInstallationId?: number;
    tokenCache?: Record<number, AuthToken>;
  };
  oauthState?: OAuthState;
  user?: UserProfile;
}

export interface TokenRefreshResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export type AuthEventType =
  | 'auth:login-success'
  | 'auth:login-error'
  | 'auth:logout'
  | 'auth:token-refreshed'
  | 'auth:installation-selected'
  | 'auth:state-changed';

export interface AuthEvent {
  type: AuthEventType;
  payload?: any;
  timestamp: number;
}
