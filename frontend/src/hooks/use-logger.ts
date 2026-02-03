/**
 * React hook for feature-based logging
 * Provides a typed logger for the specified feature
 */

import { useCallback, useMemo, useRef } from 'react';
import type { LogFeature } from '../lib/types/logs';
import { logger, FeatureLogger } from '../lib/logger';

/**
 * Hook options
 */
export interface UseLoggerOptions {
  /** Additional context to include with every log */
  context?: Record<string, unknown>;
  /** Whether to include component name in context */
  includeComponentName?: boolean;
}

/**
 * Use a logger for a specific feature
 * 
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const log = useLogger('chat');
 *   
 *   useEffect(() => {
 *     log.info('Component mounted');
 *   }, []);
 *   
 *   const handleSend = () => {
 *     log.info('Sending message', { messageId: '123' });
 *   };
 * }
 * ```
 */
export function useLogger(
  feature: LogFeature,
  options: UseLoggerOptions = {}
): FeatureLogger {
  const { context = {}, includeComponentName = true } = options;
  const componentNameRef = useRef<string>('');

  // Try to get component name from React internals
  if (includeComponentName && !componentNameRef.current) {
    try {
      const error = new Error();
      const stack = error.stack;
      if (stack) {
        const match = stack.split('\n')[2]?.match(/at (.+?) /);
        if (match) {
          componentNameRef.current = match[1];
        }
      }
    } catch {
      // Ignore
    }
  }

  const baseLogger = useMemo(() => logger.for(feature), [feature]);

  // Create wrapped logger with additional context
  const wrappedLogger = useMemo(() => {
    const fullContext = {
      ...context,
      ...(componentNameRef.current && { component: componentNameRef.current }),
    };

    const hasContext = Object.keys(fullContext).length > 0;

    if (!hasContext) {
      return baseLogger;
    }

    // Create a wrapper that adds context to every call
    return {
      trace: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.trace(msg, { ...fullContext, ...ctx }),
      debug: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.debug(msg, { ...fullContext, ...ctx }),
      info: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.info(msg, { ...fullContext, ...ctx }),
      warn: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.warn(msg, { ...fullContext, ...ctx }),
      error: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.error(msg, { ...fullContext, ...ctx }),
      fatal: (msg: string, ctx?: Record<string, unknown>) =>
        baseLogger.fatal(msg, { ...fullContext, ...ctx }),
    } as FeatureLogger;
  }, [baseLogger, context]);

  return wrappedLogger;
}

/**
 * Hook to log when component mounts/unmounts
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useLifecycleLogger('chat', 'MyComponent');
 *   // ...
 * }
 * ```
 */
export function useLifecycleLogger(
  feature: LogFeature,
  componentName: string,
  additionalContext?: Record<string, unknown>
): void {
  const log = useLogger(feature, {
    context: { component: componentName, ...additionalContext },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hasLoggedRef = useRef(false);

  if (!hasLoggedRef.current) {
    hasLoggedRef.current = true;
    log.info(`${componentName} mounted`);
  }
}

/**
 * Hook to log performance metrics
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const perf = usePerformanceLogger('chat');
 *   
 *   const handleClick = () => {
 *     perf.measure('button_click', () => {
 *       // expensive operation
 *     });
 *   };
 * }
 * ```
 */
export function usePerformanceLogger(feature: LogFeature) {
  const log = useLogger(feature);

  const measure = useCallback(
    <T>(operationName: string, fn: () => T): T => {
      const start = performance.now();
      try {
        const result = fn();
        const duration = performance.now() - start;
        log.debug(`Operation completed: ${operationName}`, {
          operation: operationName,
          duration: `${duration.toFixed(2)}ms`,
        });
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        log.error(`Operation failed: ${operationName}`, {
          operation: operationName,
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [log]
  );

  const measureAsync = useCallback(
    async <T>(operationName: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = performance.now() - start;
        log.debug(`Async operation completed: ${operationName}`, {
          operation: operationName,
          duration: `${duration.toFixed(2)}ms`,
        });
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        log.error(`Async operation failed: ${operationName}`, {
          operation: operationName,
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [log]
  );

  return { measure, measureAsync };
}

/**
 * Hook to log render counts (development only)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderLogger('chat', 'MyComponent');
 *   // ...
 * }
 * ```
 */
export function useRenderLogger(
  feature: LogFeature,
  componentName: string,
  logEvery = 1
): void {
  if (import.meta.env.PROD) return;

  const renderCount = useRef(0);
  const log = useLogger(feature);

  renderCount.current++;

  if (renderCount.current % logEvery === 0) {
    log.debug(`${componentName} rendered`, {
      component: componentName,
      renderCount: renderCount.current,
    });
  }
}

/**
 * Hook to get logger configuration
 */
export function useLoggerConfig() {
  return {
    config: logger.getConfig(),
    configure: logger.configure,
    reset: logger.resetConfig,
    flush: logger.flush,
    getPendingCount: logger.getPendingCount,
    clearPending: logger.clearPending,
  };
}
