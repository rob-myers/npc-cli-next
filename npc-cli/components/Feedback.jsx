import React from "react";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * Provide feedback to a process.
 * - remove on resolve return `false`
 * @param {Props} props
 */
export default function Feedback(props) {

  const state = useStateRef(/** @returns {State} */ () => ({
    items: [],
    addItem(item) {
      // remove extant items containing key
      state.items = [...state.items.filter(other => other.key !== item.key), item];
      update();
    },
    onClick(e) {
      const { itemKey, linkValue }  = /** @type {HTMLElement} */ (e.target).dataset;
      const item = /** @type {FeedbackItem} */ (state.items.find(item => item.key === itemKey));
      const link = /** @type {FeedbackItemLink} */ (item.links.find(link => link.value === linkValue));
      const result = item.resolve(link.value);
      if (result === false) {
        state.removeItem(item.key);
      }
    },
    removeItem(itemKey) {
      state.items = state.items.filter(other => other.key !== itemKey);
      update();
    },
  }));
  
  React.useEffect(() => {// cache world, sync lib
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);
  
  const update = useUpdate();

  return (
    <div className="font-sans font-thin text-sm flex flex-col h-full p-2 bg-slate-900" onClick={state.onClick}>
      {state.items.map((item) => (
        <div key={item.key} className="flex gap-2 items-center p-1 border-t-2 last:border-b-2 border-gray-800">
          <div className="text-slate-200 p-1">
            {item.message}
          </div>
          {item.links.map((link, i) => (
            <button
              className="bg-gray-800 text-white hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
              key={i}
              data-item-key={item.key}
              data-link-value={link.value}
            >
              {link.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * @typedef {object} State
 * @property {FeedbackItem[]} items
 * @property {((item: FeedbackItem) => void)} addItem
 * @property {((itemKey: string) => void)} removeItem
 * @property {((e: React.MouseEvent) => void)} onClick
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef FeedbackItem
 * @property {string} key
 * @property {string} [message]
 * @property {((reply: string) => void | boolean)} resolve
 * @property {FeedbackItemLink[]} links
 */

/**
 * @typedef FeedbackItemLink
 * @property {string} label
 * @property {string} value
 */
