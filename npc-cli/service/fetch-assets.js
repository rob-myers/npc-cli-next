import { queryClient } from "./query-client";
import { ensureEventSource } from "./server-sent-events";
import { info, isDevelopment, parseJsonArg, warn } from "./generic";

export const DEV_ENV_PORT = 3000;

export const DEV_ORIGIN = 'localhost';

/**
 * - Parsed JSON stored at `static/assets/${ASSETS_META_JSON_FILENAME}`
 * - Also a react-query `queryKey`.
 */
export const ASSETS_JSON_FILENAME = "assets.json";

export const assetsEndpoint = '';

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
 * 🚧 use server-sent events (SSE)
 * Dev-only event handling, i.e. trigger component refresh onchange file
 */
export function connectDevEventsWebsocket() {

  const eventSource = ensureEventSource();

  eventSource.onmessage = event => {
    const message = parseJsonArg(event.data);

    info('🔔', 'received event', message);
    if (typeof message === 'string') {
      warn(`dev-events: unexpected message: "${message}"`);
    } else if (message.key === 'initial-message') {
      clientId = message.clientId;
    } else if (message.key === 'reload-world') {
      queryClient.refetchQueries({
        predicate({ queryKey: [queryKey] }) {
          return WORLD_QUERY_FIRST_KEY === queryKey;
        },
      }); 
    }
  };

  window.addEventListener('beforeunload', () => {
    eventSource.close();
    // fetch('/api/close-dev-events', {
    //   method: 'POST',
    //   headers: { 'content-type': 'application/json' },
    //   body: JSON.stringify({ clientId }),
    // });
  });
}

let clientId = -1;
