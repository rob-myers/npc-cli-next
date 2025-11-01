import React from "react";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";

/**
 * Provide feedback to a process.
 * @param {Props} props
 */
export default function Feedback(props) {

  const state = useStateRef(() => ({// 🚧
    foo: 'bar',
    baz() { alert('qux') },
  }));

  React.useEffect(() => {// cache world, sync lib
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);

  return (
    <div>
      Feedback
    </div>
  );
}

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */
