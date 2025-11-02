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
      const { itemKey, linkLabel }  = /** @type {HTMLElement} */ (e.target).dataset;
      if (!itemKey || !linkLabel) return;
      const item = /** @type {NPC.FeedbackItem<any>} */ (state.items.find(item => item.key === itemKey));
      const link = /** @type {NPC.FeedbackItemLink<any>} */ (item.links.find(link => link.label === linkLabel));
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
    <div className="font-sans text-sm flex flex-col h-full p-2 bg-slate-900" onClick={state.onClick}>
      {state.items.map((item) => (
        <div key={item.key} className="flex gap-2 items-center p-1 border-t-2 last:border-b-2 border-gray-800">
          <div className="text-yellow-200 p-1">
            {item.label}
          </div>
          {item.links.map((link, i) => (
            <button
              className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
              key={i}
              data-item-key={item.key}
              data-link-label={link.label}
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
 * @typedef State
 * @property {NPC.FeedbackItem<any>[]} items
 * @property {(<T>(item: NPC.FeedbackItem<T>) => void)} addItem
 * @property {((itemKey: string) => void)} removeItem
 * @property {((e: React.MouseEvent) => void)} onClick
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */
