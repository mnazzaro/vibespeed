import { Github, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/renderer/store/auth';

export const InstallationList: React.FC = () => {
  const { installations } = useAuthStore();

  const handleDeleteInstallation = async (e: React.MouseEvent, installationId: number) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement delete functionality
    console.log('Delete installation:', installationId);
  };

  const handleAddInstallation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const installationUrl = await window.electronAPI.app.getInstallationUrl();
    await window.electronAPI.app.openExternal(installationUrl);

    // Installations will automatically refresh via the auth:state-changed event
    // when the OAuth callback is received after the user adds the installation
  };

  return (
    <div className="space-y-2">
      {/* Installations List */}
      {installations?.map((installation) => (
        <div className="group relative">
          <div
            className={cn(
              'inline-flex items-center justify-start rounded-md text-sm font-medium',
              'h-9 px-2 py-2',
              'w-full justify-start pr-8'
            )}
          >
            <Avatar className="mr-2 h-4 w-4">
              <AvatarImage src={installation.account.avatar_url} alt={installation.account.login} />
              <AvatarFallback className="text-xs">
                <Github className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-mono">{installation.account.login}</span>
            {installation.account.type === 'Organization' && (
              <span className="text-muted-foreground ml-1 font-mono text-xs">(Org)</span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => handleDeleteInstallation(e, installation.id)}
            className={cn(
              'absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-all',
              'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
            )}
            title="Remove installation"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <Button
        type="button"
        onClick={handleAddInstallation}
        variant="outline"
        className="h-6 w-full justify-center px-4 py-2"
        title="Add new installation"
      >
        <Plus className="mr-1 h-3 w-3" />
        Add
      </Button>

      {/* Empty State */}
      {!installations?.length && (
        <div className="py-4 text-center">
          <p className="text-muted-foreground mb-2 text-sm">No installations found</p>
          <Button type="button" onClick={handleAddInstallation} variant="outline" size="sm">
            <Plus className="mr-1 h-3 w-3" />
            Add Installation
          </Button>
        </div>
      )}
    </div>
  );
};
