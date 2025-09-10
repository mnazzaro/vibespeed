import React, { useEffect } from 'react';
import { useAuthStore } from './store/auth';
import { LoginButton } from './components/Auth/LoginButton';
import { InstallationSelector } from './components/Auth/InstallationSelector';
import { RepositoryPicker } from './components/Auth/RepositoryPicker';

export const App: React.FC = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    error, 
    initialize,
    currentInstallation 
  } = useAuthStore();
  
  useEffect(() => {
    // Initialize auth state when app loads
    initialize();
  }, []);
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>VibeSpeed</h1>
        <div className="header-actions">
          <LoginButton />
        </div>
      </header>
      
      <main className="app-main">
        {error && (
          <div className="error-banner">
            <svg className="error-icon" width="16" height="16" viewBox="0 0 16 16">
              <path 
                d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM8 7a.75.75 0 01.75.75v3.5a.75.75 0 11-1.5 0v-3.5A.75.75 0 018 7z"
                fill="currentColor"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        {isLoading ? (
          <div className="loading-container">
            <div className="spinner large"></div>
            <p>Loading...</p>
          </div>
        ) : isAuthenticated ? (
          <div className="auth-content">
            <section className="section">
              <h2>GitHub App Installation</h2>
              <p className="section-description">
                Select a GitHub App installation to access repositories
              </p>
              <InstallationSelector />
            </section>
            
            {currentInstallation && (
              <section className="section">
                <h2>Repositories</h2>
                <p className="section-description">
                  Browse and select repositories from {currentInstallation.account.login}
                </p>
                <RepositoryPicker 
                  onSelect={(repo) => {
                    console.log('Selected repository:', repo);
                  }}
                />
              </section>
            )}
          </div>
        ) : (
          <div className="welcome-container">
            <div className="welcome-content">
              <svg className="github-logo" width="64" height="64" viewBox="0 0 16 16">
                <path 
                  fillRule="evenodd" 
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                  fill="#24292e"
                />
              </svg>
              <h2>Welcome to VibeSpeed</h2>
              <p>Sign in with GitHub to access your repositories</p>
              <p className="welcome-description">
                This app uses GitHub App installation flow to securely access
                your repositories with fine-grained permissions.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};