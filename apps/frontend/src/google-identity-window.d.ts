/**
 * Google Identity Services on `window` (auth + sign-in). Centralized so all TS files see `window.google`.
 */
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: unknown) => void;
          renderButton: (parent: HTMLElement, config: unknown) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
    onGoogleLibraryLoad?: () => void;
  }
}
