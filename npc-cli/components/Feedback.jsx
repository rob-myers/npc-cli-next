import React from "react";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

// 🚧 can remove
// 🚧 can remove on resolve

/**
 * Provide feedback to a process.
 * @param {Props} props
 */
export default function Feedback(props) {

  const state = useStateRef(/** @returns {State} */ () => ({// 🚧
    items: [],
    addItem(item) {
      state.items.push(item);
      update();
    }
  }));
  
  React.useEffect(() => {// cache world, sync lib
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);
  
  const update = useUpdate();

  return (
    <div className="flex flex-col p-2">
      {state.items.map((item, i) => (
        <div key={i} className="text-slate-200 flex gap-1">
          {item.message}
          {item.links.map((link, j) => (
            <button className="text-blue-500 cursor-pointer" key={j} onClick={() => item.resolve(link.value)}>
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
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef {Object} FeedbackItem
 * @property {string} key
 * @property {string} [message]
 * @property {((reply: string) => void)} resolve
 * @property {FeedbackItemLink[]} links
 */

/**
 * @typedef {Object} FeedbackItemLink
 * @property {string} label
 * @property {string} value
 */
