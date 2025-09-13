import { Github, LogOut, User } from 'lucide-react';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { useAuthStore } from '../../store/auth';

export const LoginButton: React.FC = () => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuthStore();

  const handleAuthAction = async () => {
    if (isAuthenticated) {
      await logout();
    } else {
      await login();
    }
  };

  if (isLoading) {
    return (
      <Button disabled variant="outline">
        <div className="border-primary mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
        {isAuthenticated ? 'Logging out...' : 'Authenticating...'}
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url} alt={user.name || user.login} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium">{user.name || user.login}</p>
            <p className="text-muted-foreground text-xs">{user.email || 'No email'}</p>
          </div>
        </div>
        <Button onClick={handleAuthAction} variant="outline" size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleAuthAction} variant="default">
      <Github className="mr-2 h-4 w-4" />
      Sign in with GitHub
    </Button>
  );
};
