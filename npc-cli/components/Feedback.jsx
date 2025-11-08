import React from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { jsStringify, warn } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @template T
 * @typedef {import("zustand/middleware/immer").WithImmer<T>} WithImmer<T>
 */
/**
 * @typedef {{ [uiKey: string]: NPC.FeedbackUi }} UiLookup
 */
/**
 * @typedef {import("zustand").UseBoundStore<WithImmer<import("zustand").StoreApi<UiLookup>>>} UiStore
 */

/**
 * Provide feedback to a process.
 * @param {Props} props
 */
export default function Feedback(props) {
  const state = useStateRef(/** @returns {State} */ () => ({
    ui: /** @type {State['ui']} */ (create(immer((get, set) => ({})))),
    addUi(item) {
      state.ui.setState({ [item.key]: feedbackUiDefToUi(item) });
      update();
    },
    removeUi(itemKey) {
      state.ui.setState(draft => {
        delete draft[itemKey];
      });
      state.ui.setState(draft => {
        delete draft[itemKey];
      });
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

      // 🚧
      onChange={e => {
        const el = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
        const { dataset: { uiKey, inputKey }, value } = el;
        if (!(typeof uiKey === 'string' && typeof inputKey === 'string')) {
          return;
        }

        // 🚧 migrate
        // const ui = /** @type {NPC.FeedbackUi} */ (state.uis.find(({ key }) => key === uiKey ));
        // const parentEl = /** @type {HTMLElement} */ (el.parentElement); // assume contains all inputs
        // const uiState = ui.inputs.reduce((agg, input) => {
        //   const el = parentEl.querySelector(`[data-input-key="${input.key}"]`);
        //   if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) agg[input.key] = el.value;
        //   return agg;
        // }, /** @type {Record<string, string>} */ ({}));

        console.log('onChange', { uiKey, inputKey }, value);
        // ui.onEvent({ type: 'change-select', uiKey, value }, uiState);
      }}
      onClick={e => {
        const el = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
        const { dataset: { uiKey, inputKey }, nodeName } = el;
        if (!(nodeName === 'BUTTON' && typeof uiKey === 'string' && typeof inputKey === 'string')) {
          return;
        }

        // 🚧 migrate
        // const ui = /** @type {NPC.FeedbackUi} */ (state.uis.find(({ key }) => key === uiKey ));
        // const parentEl = /** @type {HTMLElement} */ (el.parentElement); // assume contains all inputs
        // const uiState = ui.inputs.reduce((agg, input) => {
        //   const el = parentEl.querySelector(`[data-input-key="${input.key}"]`);
        //   if (el && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) agg[input.key] = el.value;
        //   return agg;
        // }, /** @type {Record<string, string>} */ ({}));

        console.log('onClick', { uiKey, inputKey });
        // ui.onEvent({ type: 'click-button', uiKey, inputKey }, uiState);
      }}
    >
      {Object.values(state.ui.getState()).map((ui) => (
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
 * @property {UiStore} ui
 * @property {(<T>(ui: NPC.FeedbackUiDef) => void)} addUi
 * @property {((uiKey: string) => void)} removeUi
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @param {{ ui: NPC.FeedbackUi; input: NPC.FeedbackInput }} props
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
          {input.options.map((option) => (
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

/**
 * @param {NPC.FeedbackUiDef} uiDef 
 * @returns {NPC.FeedbackUi}
 */
function feedbackUiDefToUi(uiDef) {
  const { key, label, onEvent, inputs } = uiDef;
  return {
    key,
    label,
    inputs: inputs.flatMap(input => {
      switch (input.type) {
        case 'button':
          return {...input, value: null };
        case 'checkbox':
          return {...input, value: Boolean(input.default) };
        case 'number':
          return {...input, value: Number(input.default) };
        case 'select':
          return {...input, value: input.default ?? input.options[0]?.value ?? '' };
        case 'text':
          return {...input, value: input.default ?? '' };
        default:
          warn(`Ignored feedback input with unknown type: ${jsStringify(input)}`);
          return [];
      }
    }),
    onEvent,
  };
}
