import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/renderer/store/tasks';
import { PaneConfig } from '@/shared/types/panes';

import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  paneId: string;
  config: PaneConfig;
  isActive: boolean;
}

interface TerminalInstance {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  cwd: string;
  title: string;
  element: HTMLDivElement; // Store the DOM element for each terminal
}

const TerminalPane: React.FC<TerminalPaneProps> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const terminalsRef = useRef<TerminalInstance[]>([]);

  const { activeTask } = useTaskStore();

  // Keep ref in sync with state
  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  // Get active terminal
  const activeTerminal = terminals.find((t) => t.id === activeTerminalId);

  // Create a new terminal
  const createNewTerminal = async () => {
    console.log('[Terminal] createNewTerminal called');

    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('[Terminal] ERROR: window.electronAPI is undefined!');
      alert('Electron API not available! Check preload script.');
      return;
    }

    if (!window.electronAPI.terminal) {
      console.error('[Terminal] ERROR: window.electronAPI.terminal is undefined!');
      console.log('[Terminal] Available APIs:', Object.keys(window.electronAPI));
      alert('Terminal API not available! Check preload script.');
      return;
    }

    // Determine the working directory
    let cwd = '/tmp'; // Default fallback

    // Try to get the home directory if no task is active
    if (!activeTask || activeTask.repositories.length === 0) {
      try {
        cwd = await window.electronAPI.terminal.getHomeDir();
        console.log('[Terminal] Got home directory:', cwd);
      } catch {
        console.log('[Terminal] Failed to get home directory, using /tmp');
      }
    } else {
      const firstRepo = activeTask.repositories[0];
      if (firstRepo.status === 'ready' && firstRepo.worktreePath) {
        cwd = firstRepo.worktreePath;
      }
    }

    console.log('[Terminal] Using CWD:', cwd);

    try {
      console.log('[Terminal] Calling window.electronAPI.terminal.create...');
      // Create terminal session in the main process
      const result = await window.electronAPI.terminal.create(cwd);

      if (!result.success || !result.sessionId) {
        console.error('[Terminal] Failed to create terminal session:', result.error);
        return;
      }

      console.log('[Terminal] Terminal session created:', result.sessionId);

      // Create xterm.js instance with a simple theme first
      const terminal = new Terminal({
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 10,
        theme: {
          background: '#1e1e1e',
          foreground: '#ffffff',
          cursor: '#ffffff',
          cursorAccent: '#1e1e1e',
        },
        cursorBlink: true,
        scrollback: 10000,
        convertEol: true,
      });

      // Create addons
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Create a DOM element for this terminal
      const terminalElement = document.createElement('div');
      terminalElement.style.width = '100%';
      terminalElement.style.height = '100%';
      terminalElement.style.position = 'absolute';
      terminalElement.style.top = '0';
      terminalElement.style.left = '0';
      // Show immediately if this will be the active terminal (first terminal or explicitly made active)
      terminalElement.style.display = terminals.length === 0 ? 'block' : 'none';

      // Append to container
      if (!containerRef.current) {
        console.error('[Terminal] Container ref not available');
        return;
      }

      containerRef.current.appendChild(terminalElement);

      // Wait for container to have proper dimensions before opening terminal
      const waitForContainer = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        console.log('[Terminal] Container dimensions:', rect);

        if (rect && rect.width > 0 && rect.height > 0) {
          // Container has dimensions, proceed with terminal initialization
          console.log('[Terminal] Container ready with dimensions:', rect.width, 'x', rect.height);

          // Open terminal in its element
          terminal.open(terminalElement);

          // Write a test message immediately to verify terminal is working
          // Now fit the terminal
          requestAnimationFrame(() => {
            try {
              console.log('[Terminal] Attempting initial fit for terminal');
              fitAddon.fit();

              const dimensions = fitAddon.proposeDimensions();
              console.log('[Terminal] Initial dimensions after fit:', dimensions);

              if (terminals.length === 0) {
                terminal.focus();
              }
              // Write another test after fitting
            } catch (error) {
              console.error('[Terminal] Error during initial fit:', error);
            }
          });
        } else {
          // Container not ready yet, retry
          console.log('[Terminal] Container not ready yet, retrying...');
          setTimeout(waitForContainer, 10);
        }
      };

      // Start waiting for container
      waitForContainer();

      // Set up terminal I/O
      terminal.onData((data) => {
        console.log(`[Terminal] Sending data to PTY ${result.sessionId}:`, data.length, 'bytes');
        window.electronAPI.terminal.write(result.sessionId, data);
      });

      terminal.onResize(({ cols, rows }) => {
        // Validate dimensions before resizing
        if (cols > 0 && rows > 0) {
          console.log(`[Terminal] Resizing PTY ${result.sessionId} to ${cols}x${rows}`);
          window.electronAPI.terminal.resize(result.sessionId, cols, rows);
        } else {
          console.warn(`[Terminal] Invalid resize dimensions: ${cols}x${rows}, skipping resize`);
        }
      });

      // Create terminal instance
      const newTerminal: TerminalInstance = {
        id: result.sessionId,
        terminal,
        fitAddon,
        cwd,
        title: `Terminal ${terminals.length + 1}`,
        element: terminalElement,
      };

      // Add to state and ref immediately
      setTerminals((prev) => {
        const updated = [...prev, newTerminal];
        terminalsRef.current = updated; // Update ref immediately
        return updated;
      });
      setActiveTerminalId(result.sessionId);

      // After terminal is initialized and added to state, ensure proper resize
      setTimeout(() => {
        console.log('[Terminal] Performing final resize check for:', result.sessionId);
        try {
          // Ensure the terminal element is visible
          if (terminalElement.style.display !== 'block') {
            console.log('[Terminal] Making terminal visible');
            terminalElement.style.display = 'block';
          }

          // Trigger a final fit and resize
          requestAnimationFrame(() => {
            try {
              fitAddon.fit();
              const dimensions = fitAddon.proposeDimensions();

              if (dimensions && dimensions.cols > 0 && dimensions.rows > 0) {
                console.log(`[Terminal] Final resize: ${dimensions.cols}x${dimensions.rows}`);
                window.electronAPI.terminal.resize(result.sessionId, dimensions.cols, dimensions.rows);
              }

              terminal.focus();
            } catch (error) {
              console.error('[Terminal] Error during final resize:', error);
            }
          });
        } catch (error) {
          console.error('[Terminal] Error in final resize check:', error);
        }
      }, 300);

      console.log('[Terminal] Terminal created successfully');
    } catch (error) {
      console.error('[Terminal] Error creating terminal:', error);
    }
  };

  // Switch to a terminal
  const switchToTerminal = (terminalId: string) => {
    console.log('[Terminal] Switching to terminal:', terminalId);
    setActiveTerminalId(terminalId);
  };

  // Show/hide terminals based on active terminal
  useEffect(() => {
    console.log('[Terminal] Visibility effect triggered, activeTerminalId:', activeTerminalId);
    console.log('[Terminal] Number of terminals:', terminals.length);

    // Only process if we have terminals
    if (terminals.length === 0) return;

    terminals.forEach((term) => {
      if (term.element) {
        const shouldShow = term.id === activeTerminalId;
        console.log(`[Terminal] Setting terminal ${term.id} display to: ${shouldShow ? 'block' : 'none'}`);
        term.element.style.display = shouldShow ? 'block' : 'none';

        // Fit and focus the active terminal
        if (shouldShow) {
          // Use requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            console.log(`[Terminal] Fitting and focusing terminal ${term.id}`);
            try {
              // Check if terminal is properly initialized
              if (!term.terminal || !term.fitAddon) {
                console.warn(`[Terminal] Terminal ${term.id} not fully initialized`);
                return;
              }

              term.fitAddon.fit();
              term.terminal.focus();

              // Ensure proper dimensions after showing
              const dimensions = term.fitAddon.proposeDimensions();
              if (dimensions && dimensions.cols > 0 && dimensions.rows > 0) {
                console.log(`[Terminal] Terminal ${term.id} dimensions: ${dimensions.cols}x${dimensions.rows}`);
                // Send resize to PTY to ensure prompt appears
                window.electronAPI.terminal.resize(term.id, dimensions.cols, dimensions.rows);
              } else {
                console.warn(`[Terminal] Terminal ${term.id} has invalid dimensions, using defaults`);
                // Use default dimensions
                window.electronAPI.terminal.resize(term.id, 80, 24);
                // Try fitting again after resize
                requestAnimationFrame(() => {
                  try {
                    term.fitAddon.fit();
                  } catch (e) {
                    console.error(`[Terminal] Failed to refit terminal ${term.id}:`, e);
                  }
                });
              }
            } catch (error) {
              console.error(`[Terminal] Error fitting terminal ${term.id}:`, error);
            }
          });
        }
      }
    });
  }, [activeTerminalId, terminals.length]); // Use terminals.length instead of terminals array

  // Close a terminal
  const closeTerminal = async (terminalId: string) => {
    console.log('[Terminal] Closing terminal:', terminalId);

    const terminal = terminals.find((t) => t.id === terminalId);
    if (terminal) {
      // Remove element from DOM
      if (terminal.element && terminal.element.parentNode) {
        terminal.element.parentNode.removeChild(terminal.element);
      }

      // Kill the PTY session
      await window.electronAPI.terminal.kill(terminalId);

      // Dispose xterm instance
      terminal.terminal.dispose();

      // Remove from state
      setTerminals((prev) => prev.filter((t) => t.id !== terminalId));

      // Switch to another terminal if this was active
      if (activeTerminalId === terminalId) {
        const remaining = terminals.filter((t) => t.id !== terminalId);
        setActiveTerminalId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Handle terminal data from main process - set up once on mount
  useEffect(() => {
    const handleTerminalData = (sessionId: string, data: string) => {
      console.log(`[Terminal Renderer] Data received for ${sessionId}:`, data.length, 'bytes');
      const terminal = terminalsRef.current.find((t) => t.id === sessionId);
      if (terminal) {
        console.log(`[Terminal Renderer] Writing data to terminal ${sessionId}`);
        terminal.terminal.write(data);
      } else {
        console.log(`[Terminal Renderer] WARNING: No terminal found for session ${sessionId}`);
        console.log(
          '[Terminal Renderer] Available terminals:',
          terminalsRef.current.map((t) => t.id)
        );
      }
    };

    const handleTerminalExit = (sessionId: string, code: number) => {
      console.log('[Terminal] Terminal exited:', sessionId, 'code:', code);
      // Use setState callback to ensure we have latest state
      setTerminals((prev) => prev.filter((t) => t.id !== sessionId));
      setActiveTerminalId((prev) => {
        if (prev === sessionId) {
          const remaining = terminalsRef.current.filter((t) => t.id !== sessionId);
          return remaining.length > 0 ? remaining[0].id : null;
        }
        return prev;
      });
    };

    console.log('[Terminal Renderer] Setting up data listeners on mount');
    window.electronAPI.terminal.onData(handleTerminalData);
    window.electronAPI.terminal.onExit(handleTerminalExit);

    return () => {
      console.log('[Terminal Renderer] Removing data listeners on unmount');
      window.electronAPI.terminal.removeListeners();
    };
  }, []); // Empty dependency - set up once on mount

  // Handle container resize with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        console.log('[Terminal] Container resized:', width, 'x', height);

        // Only fit if we have valid dimensions
        if (width > 0 && height > 0 && activeTerminal) {
          requestAnimationFrame(() => {
            try {
              activeTerminal.fitAddon.fit();
              const dimensions = activeTerminal.fitAddon.proposeDimensions();
              if (dimensions && dimensions.cols > 0 && dimensions.rows > 0) {
                window.electronAPI.terminal.resize(activeTerminal.id, dimensions.cols, dimensions.rows);
              }
            } catch (error) {
              console.error('[Terminal] Error during resize fit:', error);
            }
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeTerminal]);

  // Log component mount and available APIs
  useEffect(() => {
    console.log('[Terminal] TerminalPane component mounted');
    console.log('[Terminal] window.electronAPI exists:', !!window.electronAPI);
    if (window.electronAPI) {
      console.log('[Terminal] Available APIs:', Object.keys(window.electronAPI));
      console.log('[Terminal] terminal API exists:', !!window.electronAPI.terminal);
      if (window.electronAPI.terminal) {
        console.log('[Terminal] Terminal API methods:', Object.keys(window.electronAPI.terminal));
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      // Cmd/Ctrl + T for new terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        createNewTerminal();
      }

      // Cmd/Ctrl + W to close current terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && activeTerminalId) {
        e.preventDefault();
        closeTerminal(activeTerminalId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, activeTerminalId]);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Tabs */}
      <div className="flex h-8 items-center border-b border-gray-800 bg-[#141414] px-1">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={cn(
                'group flex h-6 cursor-pointer items-center gap-1 rounded px-2 text-xs transition-colors',
                terminal.id === activeTerminalId
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'
              )}
              onClick={() => switchToTerminal(terminal.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{terminal.title}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
          onClick={() => {
            console.log('[Terminal] Plus button clicked!');
            createNewTerminal();
          }}
          title="New Terminal"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="relative h-full w-full" style={{ minHeight: '100px', minWidth: '100px' }}>
          {terminals.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <TerminalIcon className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                <p className="text-sm text-gray-500">No terminal sessions</p>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={createNewTerminal}>
                  <Plus className="mr-1 h-3 w-3" />
                  New Terminal
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalPane;
