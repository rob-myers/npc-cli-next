
declare global {
  interface Window {
    __NPC_CLI_DEV_EVENTS__?: EventSource;
  }
}

export {}; // 🔔 otherwise doesn't work
