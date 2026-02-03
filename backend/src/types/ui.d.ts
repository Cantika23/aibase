/**
 * Type declarations for UI components in extensions
 * These files are evaluated in the browser context, not Node.js
 */

declare module 'react' {
  export const useState: <T>(initial: T) => [T, (value: T) => void];
  export const useEffect: (effect: () => void, deps?: any[]) => void;
  export const useRef: <T>(initial: T) => { current: T };
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T;
  export const useMemo: <T>(factory: () => T, deps: any[]) => T;
}

declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
