import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { GitHubInstallation } from '../../../shared/types/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, RefreshCw, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InstallationSelector: React.FC = () => {
  const { 
    installations, 
    currentInstallation, 
    selectInstallation,
    refreshAuth,
    isLoading 
  } = useAuthStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    const handleFocus = async () => {
      if (!installations || installations.length === 0) {
        setIsRefreshing(true);
        await refreshAuth();
        setIsRefreshing(false);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [installations, refreshAuth]);
  
  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const installationUrl = await window.electronAPI.app.getInstallationUrl();
    await window.electronAPI.app.openExternal(installationUrl);
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAuth();
    setIsRefreshing(false);
  };
  
  if (!installations || installations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8">
        <p className="mb-4 text-muted-foreground">No GitHub App installations found.</p>
        <div className="flex gap-2">
          <Button onClick={handleInstallClick} variant="default">
            <ExternalLink className="mr-2 h-4 w-4" />
            Install GitHub App
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="icon"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
    );
  }
  
  const handleSelect = async (installation: GitHubInstallation) => {
    await selectInstallation(installation.id);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <div className="flex gap-2">
        <Button
          className="w-full justify-between"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
        >
          {currentInstallation ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={currentInstallation.account.avatar_url} 
                  alt={currentInstallation.account.login}
                />
                <AvatarFallback>
                  {currentInstallation.account.login[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {currentInstallation.account.login}
              </span>
              <span className="text-xs text-muted-foreground">
                ({currentInstallation.account.type})
              </span>
            </div>
          ) : (
            <span>Select Installation</span>
          )}
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
        
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="icon"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-2 w-full rounded-md border bg-popover p-1 shadow-md">
          {installations.map((installation) => (
            <button
              key={installation.id}
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                currentInstallation?.id === installation.id && "bg-accent"
              )}
              onClick={() => handleSelect(installation)}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage 
                    src={installation.account.avatar_url} 
                    alt={installation.account.login}
                  />
                  <AvatarFallback>
                    {installation.account.login[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="font-medium">
                    {installation.account.login}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {installation.account.type} • {installation.repository_selection === 'all' ? 'All repos' : 'Selected repos'}
                  </div>
                </div>
              </div>
              {currentInstallation?.id === installation.id && (
                <Check className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};