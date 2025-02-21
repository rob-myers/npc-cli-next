// 🔔 avoid editing this file: we don't cleanup connections on dev-server

// 🚧
// it's hard to tell the dev-server which client we're using, because
// we're doing static builds (export const dynamic = 'force-static';),
// and next.js won't let us use e.g. /api/[foo]/bar, or url query params

export function ensureEventSource() {
  if (typeof eventSource === 'undefined') {
    eventSource = new EventSource(`/api/connect-dev-events`),
    eventSource.onerror = () => {
      eventSource.close();
    };
  }
  return eventSource;
}

/** @type {EventSource} */
export let eventSource;
