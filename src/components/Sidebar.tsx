import React, { useState } from 'react';
import { ChevronRight, Github, User, LogOut, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/renderer/store/auth';
import { useTaskStore } from '@/renderer/store/tasks';
import { TaskList } from '@/renderer/components/Tasks/TaskList';
import { TaskCreator } from '@/renderer/components/Tasks/TaskCreator';

interface Installation {
  id: number;
  account: {
    login: string;
    avatar_url?: string;
    type: string;
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

export const Sidebar: React.FC = () => {
  const { installations, currentInstallation, isAuthenticated, user, loadRepositories, selectInstallation, logout } = useAuthStore();
  const { startTaskCreation, cancelTaskCreation, isCreatingTask } = useTaskStore();
  const [expandedInstallations, setExpandedInstallations] = useState<Set<number>>(new Set());
  const [installationRepos, setInstallationRepos] = useState<Record<number, any[]>>({});
  const [loadingRepos, setLoadingRepos] = useState<Set<number>>(new Set());

  const toggleInstallation = async (installationId: number) => {
    const isExpanding = !expandedInstallations.has(installationId);
    
    setExpandedInstallations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(installationId)) {
        newSet.delete(installationId);
      } else {
        newSet.add(installationId);
      }
      return newSet;
    });

    if (isExpanding && !installationRepos[installationId]) {
      setLoadingRepos(prev => new Set(prev).add(installationId));
      try {
        const repos = await loadRepositories(installationId);
        setInstallationRepos(prev => ({ ...prev, [installationId]: repos }));
      } catch (error) {
        console.error('Failed to load repositories:', error);
      } finally {
        setLoadingRepos(prev => {
          const newSet = new Set(prev);
          newSet.delete(installationId);
          return newSet;
        });
      }
    }
  };

  const handleInstallationClick = async (installation: Installation) => {
    await selectInstallation(installation.id);
    await toggleInstallation(installation.id);
  };

  const handleAddInstallation = async () => {
    const installationUrl = await window.electronAPI.app.getInstallationUrl();
    await window.electronAPI.app.openExternal(installationUrl);
    
    // Installations will automatically refresh via the auth:state-changed event
    // when the OAuth callback is received after the user adds the installation
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/10">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Vibespeed</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isAuthenticated ? (
          <div className="space-y-4">
            {/* Tasks Section */}
            <div className="pb-4 border-b">
              {isCreatingTask ? (
                <TaskCreator
                  onCancel={cancelTaskCreation}
                  onComplete={cancelTaskCreation}
                />
              ) : (
                <TaskList onCreateClick={startTaskCreation} />
              )}
            </div>
            
            {/* GitHub Installations Section */}
            <div className="space-y-2">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                    GitHub Installations
                  </h2>
                  <Button
                    onClick={handleAddInstallation}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            
            {installations?.map((installation) => (
              <Collapsible
                key={installation.id}
                open={expandedInstallations.has(installation.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      currentInstallation?.id === installation.id && "bg-accent"
                    )}
                    onClick={() => handleInstallationClick(installation)}
                  >
                    <ChevronRight
                      className={cn(
                        "mr-2 h-4 w-4 transition-transform",
                        expandedInstallations.has(installation.id) && "rotate-90"
                      )}
                    />
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={installation.account.avatar_url} alt={installation.account.login} />
                      <AvatarFallback className="text-xs">
                        <Github className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{installation.account.login}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 space-y-1 py-1">
                    {loadingRepos.has(installation.id) ? (
                      <div className="flex items-center justify-center py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      </div>
                    ) : installationRepos[installation.id]?.length ? (
                      installationRepos[installation.id].map((repo) => (
                        <Button
                          key={repo.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start pl-8 text-sm"
                        >
                          <span className="truncate">{repo.name}</span>
                          {repo.private && (
                            <span className="ml-auto text-xs text-muted-foreground">Private</span>
                          )}
                        </Button>
                      ))
                    ) : (
                      <p className="pl-8 text-sm text-muted-foreground">No repositories</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            
              {!installations?.length && (
                <p className="text-sm text-muted-foreground">No installations found</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Sign in to view installations</p>
          </div>
        )}
      </div>

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
                <p className="text-sm font-medium truncate">{user.name || user.login}</p>
                <p className="text-xs text-muted-foreground truncate">@{user.login}</p>
              </div>
            </div>
            <Button 
              onClick={() => logout()}
              variant="outline" 
              size="sm" 
              className="w-full"
            >
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
              <p className="text-sm text-muted-foreground">Not signed in</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};