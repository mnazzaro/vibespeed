import React, { useEffect } from 'react';

import { Sidebar } from '../components/Sidebar';

import { LoginButton } from './components/Auth/LoginButton';
import { PaneContainer } from './components/Panes/PaneContainer';
import { TaskView } from './components/Tasks/TaskView';
import { useAuthStore } from './store/auth';
import { useTaskStore } from './store/tasks';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

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
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

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

  // If not authenticated, show only the login screen
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-center">
          <svg className="text-muted-foreground mx-auto mb-6 h-20 w-20" width="80" height="80" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              fill="currentColor"
            />
          </svg>
          <h1 className="mb-2 text-3xl font-bold">Welcome to Vibespeed</h1>
          <p className="text-muted-foreground mb-6 text-lg">Sign in with GitHub to get started</p>
          <LoginButton />
          <p className="text-muted-foreground mt-6 text-sm">
            This app uses GitHub App installation flow to securely access your repositories with fine-grained
            permissions.
          </p>
        </div>
      </div>
    );
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Task/Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="bg-background flex-1 overflow-hidden">
            {activeTask ? (
              <TaskView task={activeTask} />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-lg">
                    Press <kbd className="bg-muted rounded px-2 py-1 font-mono text-sm">⌘ + N</kbd> to create a new task
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Panes Area - Right Column */}
        <div className="w-96 overflow-hidden">
          <PaneContainer />
        </div>
      </div>
    </div>
  );
};
