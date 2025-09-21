/**
 * Basic `Subject` replacement with notion of "internal" listeners:
 *  - Internal listeners may invoke `next`
 *  - Normal listeners may not, which avoids events occurring "out of order" in later list
 * @template T
 */
export class Broadcaster {

  /**
   * These listeners never invoke `next`.
   * This avoids events occurring "out of order" due to recursive `next` invocations.
   */
  listeners = /** @type {((value: T) => void)[]} */ ([]);
  
  /**
   * These listeners can invoke `next`.
   * 
   * Ideally there should be 0 or 1 of them.
   * Given multiple, they should be independent of event re-orderings due to recursive `next`,
   * 
   * > e.g. if `enter-off-mesh` synchronously induces `clear-off-mesh`,
   * > later listeners shouldn't mind if `clear-off-mesh` comes 1st.
   */
  internals = /** @type {((value: T) => void)[]} */ ([]);

  /**
   * @param {T} value 
   */
  next(value) {
    this.listeners.forEach(listener => listener(value));
    this.internals.forEach(listener => listener(value));
  }

  /**
   * @param {object} observer
   * @param {((value: T) => void)} observer.next
   * @param {((value: T) => void)} [observer.error]
   * @param {((value: T) => void)} [observer.complete]
   * @param {{ internal?: boolean }} [opts]
   * @returns {BasicSubscription}
   */
  subscribe({ next, error, complete}, opts = {}) {
    const key = opts.internal ? 'internals' : 'listeners';
    this[key].push(next);
    const tearDowns = /** @type {(() => void)[]} */ ([]);
    return {
      unsubscribe: () => {
        this[key] = this[key].filter(l => l !== next);
        tearDowns.forEach(fn => fn());
      },
      add(fn) {
        tearDowns.push(fn);
      },
    };
  }
}

/**
 * @typedef {{ unsubscribe(): void; add(fn: () => void): void }} BasicSubscription
 */
