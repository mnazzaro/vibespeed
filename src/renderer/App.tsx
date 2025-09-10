import React, { useEffect } from 'react';
import { useAuthStore } from './store/auth';
import { useTaskStore } from './store/tasks';
import { InstallationSelector } from './components/Auth/InstallationSelector';
import { RepositoryPicker } from './components/Auth/RepositoryPicker';
import { Sidebar } from '../components/Sidebar';
import { TaskView } from './components/Tasks/TaskView';

export const App: React.FC = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    error, 
    initialize,
    currentInstallation 
  } = useAuthStore();
  
  const { activeTask, startTaskCreation } = useTaskStore();
  
  useEffect(() => {
    initialize();
  }, []);
  
  // Global keyboard shortcut for creating new tasks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd+N (Mac) or Ctrl+N (Windows/Linux)
      const isModifierPressed = e.metaKey || e.ctrlKey;
      
      // Check if we're not in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      if (isModifierPressed && e.key === 'n' && !isInputField) {
        e.preventDefault();
        startTaskCreation();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [startTaskCreation]);
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium">
              {currentInstallation ? currentInstallation.account.login : 'Dashboard'}
            </h2>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-background">
          {activeTask ? (
            <TaskView task={activeTask} />
          ) : (
            <div className="h-full overflow-y-auto p-6">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-destructive" width="16" height="16" viewBox="0 0 16 16">
                      <path 
                        d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM8 7a.75.75 0 01.75.75v3.5a.75.75 0 11-1.5 0v-3.5A.75.75 0 018 7z"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                </div>
              )}
              
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                </div>
              ) : isAuthenticated ? (
                <div className="mx-auto max-w-4xl space-y-6">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="mb-2 text-xl font-semibold">GitHub App Installation</h2>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Select a GitHub App installation to access repositories
                    </p>
                    <InstallationSelector />
                  </section>
                  
                  {currentInstallation && (
                    <section className="rounded-lg border bg-card p-6">
                      <h2 className="mb-2 text-xl font-semibold">Repositories</h2>
                      <p className="mb-4 text-sm text-muted-foreground">
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
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <svg className="mx-auto mb-4 h-16 w-16 text-muted-foreground" width="64" height="64" viewBox="0 0 16 16">
                      <path 
                        fillRule="evenodd" 
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                        fill="currentColor"
                      />
                    </svg>
                    <h2 className="mb-2 text-2xl font-semibold">Welcome to Vibespeed</h2>
                    <p className="mb-4 text-muted-foreground">Sign in with GitHub to access your repositories</p>
                    <p className="text-sm text-muted-foreground">
                      This app uses GitHub App installation flow to securely access
                      your repositories with fine-grained permissions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};