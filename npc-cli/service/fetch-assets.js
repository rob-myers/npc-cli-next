import { queryClient } from "./query-client";
import { info, isDevelopment, parseJsonArg, pause, warn } from "./generic";

export const DEV_ENV_PORT = 3000;

export const DEV_ORIGIN = 'localhost';

/**
 * - Parsed JSON stored at `static/assets/${ASSETS_META_JSON_FILENAME}`
 * - Also a react-query `queryKey`.
 */
export const ASSETS_JSON_FILENAME = "assets.json";

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
      `/${GEOMORPHS_JSON_FILENAME}${getDevCacheBustQueryParam()}`,
      baseUrl,
    )
  ).then((x) => x.json());
}

/** @param {number} sheetId */
export function getObstaclesSheetUrl(sheetId) {
  return `/2d/obstacles.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {number} sheetId */
export function getDecorSheetUrl(sheetId) {
  return `/2d/decor.${sheetId}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/**
 * @param {Key.NpcClass} npcClassKey
 * @param {number} sheetId
 */
export function getNpcSkinSheetUrl(npcClassKey, sheetId) {
  return `/3d/${npcClassKey}.${sheetId}.tex.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** @param {Key.DecorImg} decorImgKey */
export function getDecorIconUrl(decorImgKey) {
  return `/2d/${decorImgKey}.${imgExt}${getDevCacheBustQueryParam()}`;
}

/** Override cache in development */
function getDevCacheBustQueryParam() {
  return isDevelopment() ? `?v=${Date.now()}` : '';
}

export const WORLD_QUERY_FIRST_KEY = 'world';

let devEventsFailures = 0;

/**
 * Dev only event handling: trigger World refresh onchange file.
 * We use server-sent events (SSE).
 */
export function connectDevEventsWebsocket() {
  const eventSource = (
    window.__NPC_CLI_DEV_EVENTS__ ??= new EventSource(`/api/connect-dev-events`)
  );

  eventSource.onerror = async (e) => {
    console.error('connectDevEventsWebsocket', e);
    eventSource.close();
    
    if (++devEventsFailures > 5) {// stop trying
      devEventsFailures = 0;
      return;
    }

    if (clientId !== -1) {// happens on sleep/resume device
      window.__NPC_CLI_DEV_EVENTS__ = undefined;
      await pause(devEventsFailures * 1000);
      connectDevEventsWebsocket();
    }
  };

  eventSource.onmessage = event => {
    const message = parseJsonArg(event.data);
    
    if (typeof message === 'string') {
      return warn(`dev-events: unexpected message: "${message}"`);
    }
    
    info('🔔', 'received event', message);
    if (message.key === 'initial-message') {
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
    if (window.__NPC_CLI_DEV_EVENTS__) {
      window.__NPC_CLI_DEV_EVENTS__.close();
      window.__NPC_CLI_DEV_EVENTS__ = undefined;
      // fetch('/api/close-dev-events', {
      //   method: 'POST',
      //   headers: { 'content-type': 'application/json' },
      //   body: JSON.stringify({ clientId }),
      // });
    }
  });

  if ('chrome' in window) {
    const keepAlive = () => setInterval(() => null, 20e3);
    keepAlive();
  }

}

let clientId = -1;
