/**
 * - This file avoids unnecessary HMR of site.store onchange view-related constants.
 * - site.store should not import from this file.
 */
import { breakpoint, nav } from './const';
import useSite from "./site.store";

/** Navigation bar width in pixels */
export function getNavWidth() {
  const baseFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (useSite.getState().navOpen ? nav.expandedRem : nav.collapsedRem) * baseFontPx;
}

export function isSmallView() {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint})`).matches;
}
