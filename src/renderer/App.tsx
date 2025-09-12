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
      <div className="bg-background paper-texture flex h-screen items-center justify-center">
        <div className="p-8 text-center">
          <h1 className="mb-4 font-serif text-4xl">Welcome to Vibespeed</h1>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">Sign in with GitHub to begin</p>
          <LoginButton />
          <p className="text-muted-foreground mx-auto mt-8 max-w-md text-sm leading-relaxed">
            Authentication via GitHub App installation provides secure repository access.
          </p>
        </div>
      </div>
    );
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="bg-background paper-texture flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mb-4 h-6 w-6 animate-spin border-2 border-t-transparent"></div>
          <p className="text-muted-foreground font-serif">Loading...</p>
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
          <main className="bg-background paper-texture flex-1 overflow-hidden">
            {activeTask ? (
              <TaskView task={activeTask} />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                  <p className="text-muted-foreground font-serif leading-relaxed">
                    Press <kbd className="border-b px-2 py-1 font-mono text-sm">⌘ + N</kbd> to begin a new task
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
