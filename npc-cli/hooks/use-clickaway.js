// https://react-hooked.vercel.app/docs/useClickAway/
import { useEffect, useRef } from "react";

const defaultEvents = ["mousedown", "pointerdown"];

/**
 * A hook that allows to handle click events outside of the specified element.
 * @template {Event} [E=Event]
 * @param {import('react').RefObject<HTMLElement | null>} ref - The reference to the element that should be clicked outside.
 * @param {(event: E) => void} onClickAway - The callback function to be called when the click event occurs outside of the specified element.
 * @param {string[]} events - An array of event names to listen for.
 */
export default function useClickAway(
  ref,
  onClickAway,
  events = defaultEvents,
) {
  const savedCallback = useRef(onClickAway);
  useEffect(() => {
    savedCallback.current = onClickAway;
  }, [onClickAway]);
  useEffect(() => {
    /** @param {any} event */
    const handler = (event) => {
      const { current: el } = ref;
      el && !el.contains(event.target) && savedCallback.current(event);
    };
    for (const eventName of events) {
      window.addEventListener(eventName, handler, { passive: false });
    }
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handler);
      }
    };
  }, [events, ref]);
}
