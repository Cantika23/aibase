import { createContext, useContext, type ReactNode } from 'react';
import { useIsMobile, useIsTouchDevice } from '@/lib/hooks/use-media-query';

interface PlatformContextType {
  /** Whether the current viewport is mobile (< 768px) */
  isMobile: boolean;
  /** Whether the current viewport is desktop (>= 768px) */
  isDesktop: boolean;
  /** Whether the device supports touch */
  isTouchDevice: boolean;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

/**
 * Provider component for platform detection
 * Wrap your app with this to enable usePlatform hook
 */
export function PlatformProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const isTouchDevice = useIsTouchDevice();
  
  return (
    <PlatformContext.Provider value={{ 
      isMobile, 
      isDesktop: !isMobile,
      isTouchDevice 
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

/**
 * Hook to access platform detection
 * Must be used within PlatformProvider
 */
export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}
