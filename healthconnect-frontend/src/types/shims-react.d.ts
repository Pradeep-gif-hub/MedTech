// Minimal React/JSX shims to allow the component to typecheck/run without installing @types/react
// This is a temporary local shim for quick development / isolated rendering.

declare module 'react' {
  const React: any;
  export default React;
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export type FC<P = {}> = any;
  export type ReactNode = any;
}

declare module 'socket.io-client' {
  export type Socket = any;
  export function io(url: string, options?: any): any;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any): any;
  export function jsxs(type: any, props?: any): any;
  export function jsxDEV(type: any, props?: any): any;
}

// Allow any JSX intrinsic elements so TSX compiles in a pinched environment
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
