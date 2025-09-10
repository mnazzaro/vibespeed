import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { GitHubInstallation } from '../../../shared/types/auth';

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
  
  // Auto-refresh installations when window gains focus
  useEffect(() => {
    const handleFocus = async () => {
      // Only refresh if we don't have installations
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
      <div className="installation-selector empty">
        <p>No GitHub App installations found.</p>
        <div className="installation-actions">
          <a 
            href="#" 
            onClick={handleInstallClick}
            className="install-link"
          >
            Install GitHub App
          </a>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="refresh-button"
            title="Refresh installations"
          >
            {isRefreshing ? (
              <span className="spinner small"></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.65 2.35a8 8 0 10-.704 11.746l-1.06-1.06A6.5 6.5 0 112.35 3.65l1.06-1.06a8 8 0 0111.296.704zM8 3a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-4.25A.75.75 0 017.25 8V3.75A.75.75 0 018 3z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }
  
  const handleSelect = async (installation: GitHubInstallation) => {
    await selectInstallation(installation.id);
    setIsOpen(false);
  };
  
  return (
    <div className="installation-selector">
      <div className="installation-selector-header">
        <button 
          className="installation-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
        >
          {currentInstallation ? (
            <div className="selected-installation">
              <img 
                src={currentInstallation.account.avatar_url} 
                alt={currentInstallation.account.login}
                className="installation-avatar"
              />
              <span className="installation-name">
                {currentInstallation.account.login}
              </span>
              <span className="installation-type">
                ({currentInstallation.account.type})
              </span>
            </div>
          ) : (
            <span>Select Installation</span>
          )}
          <svg 
            className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
            width="12" 
            height="8" 
            viewBox="0 0 12 8"
          >
            <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="refresh-button icon-only"
          title="Refresh installations"
        >
          {isRefreshing ? (
            <span className="spinner small"></span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.65 2.35a8 8 0 10-.704 11.746l-1.06-1.06A6.5 6.5 0 112.35 3.65l1.06-1.06a8 8 0 0111.296.704zM8 3a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-4.25A.75.75 0 017.25 8V3.75A.75.75 0 018 3z"/>
            </svg>
          )}
        </button>
      </div>
      
      {isOpen && (
        <div className="installation-dropdown">
          {installations.map((installation) => (
            <button
              key={installation.id}
              className={`installation-option ${
                currentInstallation?.id === installation.id ? 'selected' : ''
              }`}
              onClick={() => handleSelect(installation)}
            >
              <img 
                src={installation.account.avatar_url} 
                alt={installation.account.login}
                className="installation-avatar"
              />
              <div className="installation-info">
                <span className="installation-name">
                  {installation.account.login}
                </span>
                <span className="installation-meta">
                  {installation.account.type} • {installation.repository_selection === 'all' ? 'All repos' : 'Selected repos'}
                </span>
              </div>
              {currentInstallation?.id === installation.id && (
                <svg 
                  className="check-icon" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 16 16"
                >
                  <path 
                    d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};