import { User, LogOut, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

import { InstallationList } from '@/components/InstallationList';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TaskCreator } from '@/renderer/components/Tasks/TaskCreator';
import { TaskList } from '@/renderer/components/Tasks/TaskList';
import { useAuthStore } from '@/renderer/store/auth';
import { useTaskStore } from '@/renderer/store/tasks';

export const Sidebar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { startTaskCreation, cancelTaskCreation, isCreatingTask } = useTaskStore();
  const [isInstallationsExpanded, setIsInstallationsExpanded] = useState(false);

  return (
    <div className="bg-muted/10 flex h-full w-64 flex-col border-r">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Vibespeed</h1>
      </div>

      {/* Main Content Area - Tasks */}
      <div className="flex-1 overflow-y-auto p-4">
        {isAuthenticated ? (
          <div>
            {/* Tasks Section */}
            {isCreatingTask ? (
              <TaskCreator onCancel={cancelTaskCreation} onComplete={cancelTaskCreation} />
            ) : (
              <TaskList onCreateClick={startTaskCreation} />
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-muted-foreground text-sm">Sign in to get started</p>
          </div>
        )}
      </div>

      {/* GitHub Installations Section - Collapsible at bottom */}
      {isAuthenticated && (
        <div
          className={cn(
            'border-t transition-all duration-300 ease-in-out',
            isInstallationsExpanded ? 'max-h-96' : 'max-h-10'
          )}
        >
          <button
            type="button"
            onClick={() => setIsInstallationsExpanded(!isInstallationsExpanded)}
            className="hover:bg-muted/20 flex w-full items-center justify-between px-4 py-3 transition-colors"
          >
            <h2 className="text-muted-foreground text-xs font-semibold uppercase">GitHub Installations</h2>
            <ChevronUp
              className={cn('h-4 w-4 transition-transform duration-200', !isInstallationsExpanded && 'rotate-180')}
            />
          </button>
          <div
            className={cn(
              'overflow-y-auto transition-all duration-300',
              isInstallationsExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            <div className="px-4 pb-4">
              <InstallationList />
            </div>
          </div>
        </div>
      )}

      {/* Profile Section at Bottom */}
      <div className="border-t p-4">
        {isAuthenticated && user ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={user.avatar_url} alt={user.login} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user.name || user.login}</p>
                <p className="text-muted-foreground truncate text-xs">@{user.login}</p>
              </div>
            </div>
            <Button onClick={() => logout()} variant="outline" size="sm" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">Not signed in</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
