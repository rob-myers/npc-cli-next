import React from "react";

/**
 * @param {React.PropsWithChildren<{ layoutPresetKey: Key.LayoutPreset }>} props
 */
export default function TabsLayoutLink(props) {
  return (
    <a href={`#/internal/set-tabs/${props.layoutPresetKey}`}>{props.children}</a>
  );
}
