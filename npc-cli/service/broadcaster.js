/**
 * Basic `Subject` replacement with notion of "independent" listeners:
 *  - These listeners never invoke `next`
 *  - They avoid events occurring "out of order"
 * @template T
 */
export class Broadcaster {

  /**
   * A listener is independent if it never invokes `next`.
   * This avoids events occurring "out of order" due to recursive `next` invocations.
   */
  independents = /** @type {((value: T) => void)[]} */ ([]);
  
  /**
   * These listeners can invoke `next`.
   * 
   * Ideally there should be 0 or 1 of them.
   * Given multiple, they should be independent of event re-orderings due to recursive `next`,
   * 
   * > e.g. if `enter-off-mesh` induces `clear-off-mesh`,
   * > later listeners shouldn't mind if `clear-off-mesh` comes 1st.
   */
  listeners = /** @type {((value: T) => void)[]} */ ([]);

  /**
   * @param {T} value 
   */
  next(value) {
    this.independents.forEach(listener => listener(value));
    this.listeners.forEach(listener => listener(value));
  }

  /**
   * @param {object} observer
   * @param {((value: T) => void)} observer.next
   * @param {((value: T) => void)} [observer.error]
   * @param {((value: T) => void)} [observer.complete]
   * @param {boolean} [independent]
   * @returns {BasicSubscription}
   */
  subscribe({ next, error, complete}, independent = false) {
    const key = independent ? 'independents' : 'listeners';
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
