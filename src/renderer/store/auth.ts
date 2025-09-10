import { create } from 'zustand';
import { 
  AuthState, 
  GitHubInstallation, 
  UserProfile,
  AuthToken,
  GitHubRepository 
} from '../../shared/types/auth';

interface AuthStore extends AuthState {
  // Actions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  selectInstallation: (installationId: number) => Promise<void>;
  refreshAuth: () => Promise<void>;
  loadRepositories: (installationId: number) => Promise<GitHubRepository[]>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: false,
  user: null,
  installations: [],
  currentInstallation: null,
  token: null,
  error: null,
  
  // Actions
  login: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await window.electronAPI.auth.startFlow();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start authentication flow');
      }
      
      // The auth flow will continue via deep link callback
      // Listen for the callback
      window.electronAPI.auth.onCallbackReceived((response) => {
        if (response.success) {
          set({
            isAuthenticated: true,
            user: response.data?.user || null,
            installations: response.data?.installations || [],
            isLoading: false,
            error: null,
          });
        } else {
          set({
            isLoading: false,
            error: response.error || 'Authentication failed',
          });
        }
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Authentication failed',
      });
    }
  },
  
  logout: async () => {
    set({ isLoading: true });
    
    try {
      await window.electronAPI.auth.logout();
      set({
        isAuthenticated: false,
        user: null,
        installations: [],
        currentInstallation: null,
        token: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Logout failed',
      });
    }
  },
  
  selectInstallation: async (installationId: number) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await window.electronAPI.auth.selectInstallation(installationId);
      
      if (response.success) {
        const installation = get().installations.find(i => i.id === installationId);
        set({
          currentInstallation: installation || null,
          token: response.data?.token || null,
          isLoading: false,
        });
      } else {
        throw new Error(response.error || 'Failed to select installation');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to select installation',
      });
    }
  },
  
  refreshAuth: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await window.electronAPI.auth.refreshToken();
      
      if (response.success) {
        set({
          user: response.data?.user || get().user,
          installations: response.data?.installations || get().installations,
          isLoading: false,
        });
      } else {
        throw new Error(response.error || 'Failed to refresh authentication');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to refresh authentication',
      });
    }
  },
  
  loadRepositories: async (installationId: number) => {
    try {
      const repositories = await window.electronAPI.auth.getRepositories(installationId);
      return repositories;
    } catch (error) {
      console.error('Failed to load repositories:', error);
      return [];
    }
  },
  
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setError: (error: string | null) => {
    set({ error });
  },
  
  initialize: async () => {
    set({ isLoading: true });
    
    try {
      // Get initial auth state
      const state = await window.electronAPI.auth.getState();
      
      set({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        installations: state.installations,
        currentInstallation: state.currentInstallation,
        token: state.token,
        isLoading: false,
      });
      
      // Set up event listeners
      window.electronAPI.auth.onStateChanged((data) => {
        set({
          isAuthenticated: data.isAuthenticated,
          user: data.user,
          installations: data.installations,
        });
      });
      
      window.electronAPI.auth.onInstallationSelected((data) => {
        const installation = get().installations.find(i => i.id === data.installationId);
        set({
          currentInstallation: installation || null,
          token: data.token,
        });
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error.message || 'Failed to initialize authentication',
      });
    }
  },
}));