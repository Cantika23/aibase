/**
 * Logger Provider - Application-wide logging configuration
 * 
 * Wrap your app with this provider to configure logging globally.
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <LoggerProvider
 *       config={{
 *         minLevel: 'debug',
 *         enabledFeatures: ['chat', 'websocket'],
 *         sendToBackend: true,
 *       }}
 *     >
 *       <YourApp />
 *     </LoggerProvider>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LoggerConfig, LogLevel, LogFeature } from '../../lib/types/logs';
import { logger } from '../../lib/logger';

interface LoggerContextValue {
  /** Current configuration */
  config: LoggerConfig;
  /** Update configuration */
  setConfig: (config: Partial<LoggerConfig>) => void;
  /** Reset to defaults */
  resetConfig: () => void;
  /** Force flush pending logs */
  flush: () => Promise<void>;
  /** Get pending logs count */
  pendingCount: number;
  /** Clear pending logs */
  clearPending: () => void;
  /** Enable/disable specific feature */
  toggleFeature: (feature: LogFeature, enabled: boolean) => void;
  /** Set minimum log level */
  setMinLevel: (level: LogLevel) => void;
  /** Enable/disable backend logging */
  setSendToBackend: (enabled: boolean) => void;
  /** Enable/disable console output */
  setConsoleOutput: (enabled: boolean) => void;
}

const LoggerContext = createContext<LoggerContextValue | null>(null);

export interface LoggerProviderProps {
  children: React.ReactNode;
  /** Initial configuration */
  config?: Partial<LoggerConfig>;
}

export function LoggerProvider({ children, config: initialConfig }: LoggerProviderProps) {
  const [config, setConfigState] = useState<LoggerConfig>(() => {
    if (initialConfig) {
      logger.configure(initialConfig);
    }
    return logger.getConfig();
  });

  const [pendingCount, setPendingCount] = useState(0);

  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(logger.getPendingCount());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const setConfig = React.useCallback((newConfig: Partial<LoggerConfig>) => {
    logger.configure(newConfig);
    setConfigState(logger.getConfig());
  }, []);

  const resetConfig = React.useCallback(() => {
    logger.resetConfig();
    setConfigState(logger.getConfig());
  }, []);

  const flush = React.useCallback(async () => {
    await logger.flush();
    setPendingCount(logger.getPendingCount());
  }, []);

  const clearPending = React.useCallback(() => {
    logger.clearPending();
    setPendingCount(0);
  }, []);

  const toggleFeature = React.useCallback((feature: LogFeature, enabled: boolean) => {
    const currentFeatures = new Set(config.enabledFeatures);
    if (enabled) {
      currentFeatures.add(feature);
    } else {
      currentFeatures.delete(feature);
    }
    setConfig({ enabledFeatures: Array.from(currentFeatures) });
  }, [config.enabledFeatures, setConfig]);

  const setMinLevel = React.useCallback((level: LogLevel) => {
    setConfig({ minLevel: level });
  }, [setConfig]);

  const setSendToBackend = React.useCallback((enabled: boolean) => {
    setConfig({ sendToBackend: enabled });
  }, [setConfig]);

  const setConsoleOutput = React.useCallback((enabled: boolean) => {
    setConfig({ consoleOutput: enabled });
  }, [setConfig]);

  const value: LoggerContextValue = {
    config,
    setConfig,
    resetConfig,
    flush,
    pendingCount,
    clearPending,
    toggleFeature,
    setMinLevel,
    setSendToBackend,
    setConsoleOutput,
  };

  return (
    <LoggerContext.Provider value={value}>
      {children}
    </LoggerContext.Provider>
  );
}

/**
 * Hook to access logger context
 * Must be used within a LoggerProvider
 */
export function useLoggerContext(): LoggerContextValue {
  const context = useContext(LoggerContext);
  if (!context) {
    throw new Error('useLoggerContext must be used within a LoggerProvider');
  }
  return context;
}

/**
 * Development-only logger controls component
 * Shows a floating panel to control logging settings
 */
export function LoggerControls() {
  if (import.meta.env.PROD) return null;

  const {
    config,
    pendingCount,
    flush,
    clearPending,
    toggleFeature,
    setMinLevel,
    setSendToBackend,
    setConsoleOutput,
  } = useLoggerContext();

  const [isOpen, setIsOpen] = useState(false);

  const allFeatures: LogFeature[] = [
    'general',
    'chat',
    'files',
    'auth',
    'websocket',
    'extensions',
    'ui',
    'api',
  ];

  const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      {isOpen ? (
        <div
          style={{
            background: '#1f2937',
            color: '#f3f4f6',
            padding: '12px',
            borderRadius: '8px',
            minWidth: '250px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <strong>Logger Controls</strong>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>
              Min Level:{' '}
              <select
                value={config.minLevel}
                onChange={(e) => setMinLevel(e.target.value as LogLevel)}
                style={{
                  background: '#374151',
                  color: '#f3f4f6',
                  border: '1px solid #4b5563',
                  borderRadius: '4px',
                }}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={config.sendToBackend}
                onChange={(e) => setSendToBackend(e.target.checked)}
              />
              Send to Backend
            </label>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={config.consoleOutput}
                onChange={(e) => setConsoleOutput(e.target.checked)}
              />
              Console Output
            </label>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px' }}>Features:</div>
            <div
              style={{
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {allFeatures.map((feature) => (
                <label
                  key={feature}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <input
                    type="checkbox"
                    checked={config.enabledFeatures.includes(feature)}
                    onChange={(e) => toggleFeature(feature, e.target.checked)}
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              onClick={flush}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Flush ({pendingCount})
            </button>
            <button
              onClick={clearPending}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: '#1f2937',
            color: '#f3f4f6',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📝 Logs
          {pendingCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
