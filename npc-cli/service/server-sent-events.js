// 🔔 avoid editing this file... the browser supports few SSE connections

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
