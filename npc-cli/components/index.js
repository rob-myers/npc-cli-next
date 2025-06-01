// https://github.com/microsoft/TypeScript/issues/32063
// 🤔 could auto-gen parallel declarations?
// https://github.com/microsoft/TypeScript/issues/32063#issuecomment-2615440930

import { geomorph } from '../service/geomorph';
import geomorphsDotJson from '@/public/geomorphs.json';

/** @type {Geomorph.GeomorphsJson} */
export const geomorphsJson =  /** @type {*} */ (
  geomorphsDotJson
);

export const geomorphs = geomorph.deserializeGeomorphs(geomorphsJson)

export const mapKeys = /** @type {Key.Map[]} */ (
  Object.keys(geomorphsJson.map)
);
