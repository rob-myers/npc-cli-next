
declare global {
  interface Window {
    __DEV_EVENTS__?: EventSource;
  }
}

export {}; // 🔔 otherwise doesn't work
