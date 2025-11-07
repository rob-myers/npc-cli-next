import React from "react";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

// 🚧 send events instead of invoking resolve

/**
 * Provide feedback to a process.
 * - remove on resolve return `false`
 * @param {Props} props
 */
export default function Feedback(props) {
  const state = useStateRef(/** @returns {State} */ () => ({
    uis: [],
    addUi(item) {
      // remove extant items containing key
      state.uis = [...state.uis.filter(other => other.key !== item.key), item];
      update();
    },
    removeUi(itemKey) {
      state.uis = state.uis.filter(other => other.key !== itemKey);
      update();
    },
  }));
  
  React.useEffect(() => {
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);
  
  const update = useUpdate();

  return (
    <div
      className="font-sans text-sm p-2 bg-slate-900 flex flex-col v-full overflow-auto"
      onChange={e => {
        const el = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
        const { dataset: { uiKey, inputKey }, value } = el;
        if (!(typeof uiKey === 'string' && typeof inputKey === 'string')) {
          return;
        }

        // 🚧 abstract
        const ui = /** @type {NPC.FeedbackUi} */ (state.uis.find(({ key }) => key === uiKey ));
        const parentEl = /** @type {HTMLElement} */ (el.parentElement); // assume contains all inputs
        const uiState = ui.inputs.reduce((agg, input) => {
          const el = parentEl.querySelector(`[data-input-key="${input.key}"]`);
          if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) agg[input.key] = el.value;
          return agg;
        }, /** @type {Record<string, string>} */ ({}));

        console.log('onChange', { uiKey, inputKey }, value);
        ui.onEvent({ type: 'change-select', uiKey, value }, uiState);
      }}
      onClick={e => {
        const el = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
        const { dataset: { uiKey, inputKey }, nodeName } = el;
        if (!(nodeName === 'BUTTON' && typeof uiKey === 'string' && typeof inputKey === 'string')) {
          return;
        }

        // 🚧 abstract
        const ui = /** @type {NPC.FeedbackUi} */ (state.uis.find(({ key }) => key === uiKey ));
        const parentEl = /** @type {HTMLElement} */ (el.parentElement); // assume contains all inputs
        const uiState = ui.inputs.reduce((agg, input) => {
          const el = parentEl.querySelector(`[data-input-key="${input.key}"]`);
          if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) agg[input.key] = el.value;
          return agg;
        }, /** @type {Record<string, string>} */ ({}));

        console.log('onClick', { uiKey, inputKey });
        ui.onEvent({ type: 'click-button', uiKey, inputKey }, uiState);
      }}
    >
      {state.uis.map((ui) => (
        <div key={ui.key} className="flex gap-2 flex-wrap items-center p-1 border-t-2 last:border-b-2 border-gray-800">
          {ui.label && <div>{ui.label}</div>}
          {ui.inputs.map((input) => (
            <FeedbackUiInput key={input.key} ui={ui} input={input} />
          ))}
        </div>
      ))}
          
    </div>
  );
}

/**
 * @typedef State
 * @property {NPC.FeedbackUi[]} uis
 * @property {(<T>(ui: NPC.FeedbackUi) => void)} addUi
 * @property {((uiKey: string) => void)} removeUi
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @param {{ ui: NPC.FeedbackUi; input: NPC.FeedbackUiInput }} props
 */
function FeedbackUiInput({ ui, input }) {
  switch (input.type) {
    case 'button':
      return (
        <button
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
          data-ui-key={ui.key}
          data-input-key={input.key}
        >
          {input.label ?? input.key}
        </button>
      );
    case 'checkbox':
      return (
        <input type="checkbox"
          data-ui-key={ui.key}
          data-input-key={input.key}
          defaultChecked={input.default}
        />
      );
    case 'number':
      return (
        <input type="number"
          data-ui-key={ui.key}
          data-input-key={input.key}
          defaultValue={input.default}
        />
      );
    case 'select':
      return (
        <select
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
          data-ui-key={ui.key}
          data-input-key={input.key}
        >
          {/* invoke-per-render provides a kind of "live" functionality */}
          {(typeof input.options === 'function' ? input.options() : []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'text':
      return (
        <input
          data-ui-key={ui.key}
          data-input-key={input.key}
          type="text"
          placeholder={input.placeholder}
          defaultValue={input.default}
        />
      );
  default:
    return null;
  }
}
