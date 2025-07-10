import React from "react";

/**
 * - Based on https://stackoverflow.com/a/54749871/2917822
 * - Invokes `config.onClick` if press isn't long enough.
 * - On touchstart will only consider touchevents
 * @param {Config} config
 */
export default function useLongPress(config) {
  const ms = config.ms ?? 0;
  const timerId = React.useRef(-1);
  const epochMs = React.useRef(-1);
  const touched = React.useRef(false);

  return React.useMemo(
    () => ({
      onMouseDown() {
        if (touched.current === true) return;
        timerId.current = window.setTimeout(config.onLongPress, config.ms);
        epochMs.current = Date.now();
      },
      onTouchStart() {
        touched.current = true; // touch events now take precedence
        timerId.current = window.setTimeout(config.onLongPress, config.ms);
        epochMs.current = Date.now();
      },
      /** @param {React.MouseEvent} e */
      onMouseUp(e) {
        if (touched.current === true) return;
        clearTimeout(timerId.current);
        Date.now() - epochMs.current < ms && config.onClick?.(e);
      },
      /** @param {React.TouchEvent} e */
      onTouchEnd(e) {
        clearTimeout(timerId.current);
        Date.now() - epochMs.current < ms && config.onClick?.(e);
      },
      onMouseLeave() {
        if (touched.current = true) return;
        clearTimeout(timerId.current);
      },
      /** @param {React.KeyboardEvent} e */
      onKeyDown(e) {
        clearTimeout(timerId.current);
        ["Enter", " "].includes(e.key) && config.onClick?.(e);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.onLongPress, config.onClick, ms]
  );
}

/**
 * @typedef Config
 * @property {() => void} onLongPress
 * @property {(e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => void} [onClick]
 * @property {number} [ms]
 */
