/**
 * 🚧 clean
 */
import { uid } from "uid";
import { queryClient } from "./query-client";
import { ensureEventSource } from "./server-sent-events";
import { info, isDevelopment, parseJsonArg, warn } from "./generic";

export const DEV_ENV_PORT = 3000;

/** See `npm run develop` */
export const DEV_GATSBY_PORT = 8011;

/** See `npm run ws-server` */
export const DEV_EXPRESS_WEBSOCKET_PORT = 8012;

/**
 * 🔔🔔🔔
 * Change for local mobile debugging, e.g. via:
 * `ifconfig | grep "inet " | grep -v 127.0.0.1`
*/
export const DEV_ORIGIN = 'localhost';
// export const DEV_ORIGIN = '192.168.16.66';
// export const DEV_ORIGIN = '192.168.59.66';
// export const DEV_ORIGIN = '192.168.219.66';

/**
 * - Parsed JSON stored at `static/assets/${ASSETS_META_JSON_FILENAME}`
 * - Also a react-query `queryKey`.
 */
export const ASSETS_JSON_FILENAME = "assets.json";

export const assetsEndpoint = '';
// export const assetsEndpoint = 'http://localhost:3000';

export const GEOMORPHS_JSON_FILENAME = "geomorphs.json";

export const imgExt = isDevelopment() ? 'png' : 'png.webp';


/**
 * Requires @see {baseUrl} because also runs in webworker.
 * @param {string} baseUrl 
 * @returns {Promise<Geomorph.GeomorphsJson>}
 */
export async function fetchGeomorphsJson(baseUrl) {
  return await fetch(
    new URL(
      `${assetsEndpoint}/${GEOMORPHS_JSON_FILENAME}${getDevCacheBustQueryParam()}`,
      baseUrl,
    )
  ).then((x) => x.json());
}

/** @param {number} sheetId */
export function getObstaclesSheetUrl(sheetId) {
  return `${assetsEndpoint}/2d/obstacles.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {number} sheetId */
export function getDecorSheetUrl(sheetId) {
  return `${assetsEndpoint}/2d/decor.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {Geomorph.DecorImgKey} decorImgKey */
export function getDecorIconUrl(decorImgKey) {
  return `${assetsEndpoint}/2d/${decorImgKey}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** Override cache in development */
function getDevCacheBustQueryParam() {
  return isDevelopment() ? `?v=${Date.now()}` : '';
}

export const WORLD_QUERY_FIRST_KEY = 'world';

/**
 * 🚧 try use server-sent events (SSE)
 * 
 * Dev-only event handling:
 * > trigger component refresh on file change
 */
export function connectDevEventsWebsocket() {

  const eventSource = ensureEventSource();
  // eventSource = new EventSource(`/api/connect-dev-events`);

  eventSource.onmessage = event => {
    const message = parseJsonArg(event.data);

    if (typeof message === 'string') {
      warn(`dev-events: unexpected message: "${message}"`);
      return;
    }

    console.log('🔔', 'received event', message);
    if (message.key === 'initial-message') {
      clientId = message.clientId;
      console.log('🔔', 'clientId is', clientId);
    }
  };

  window.addEventListener('beforeunload', () => {
    eventSource.close();
    fetch('/api/close-dev-events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientId }),
    });
  });

  // const url = `ws://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/dev-events`;
  // const wsClient = new WebSocket(url);
  // wsClient.onmessage = async (e) => {
  //   info(`received websocket message:`, { url, data: e.data });

  //   queryClient.refetchQueries({
  //     predicate({ queryKey: [queryKey] }) {
  //       return WORLD_QUERY_FIRST_KEY === queryKey;
  //     },
  //   });
  // };

  // wsClient.onopen = (_e) => {
  //   info(`${url} connected`);
  //   wsAttempts = 0;
  // };
  // wsClient.onclose = (_e) => {
  //   info(`${url} closed: reconnecting...`);
  //   if (++wsAttempts <= 5) {
  //     setTimeout(connectDevEventsWebsocket, (2 ** wsAttempts) * 300);
  //   } else {
  //     info(`${url} closed: gave up reconnecting`);
  //   }
  // };
}

let wsAttempts = 0;

/** @type {EventSource} */
let eventSource;

let clientId = -1;
