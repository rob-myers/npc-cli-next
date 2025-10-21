import React from "react";
import loadable from "@loadable/component";

export const HelloWorld = loadableComponentFactory(() => import("../components/HelloWorld"));

export const Manage = loadableComponentFactory(() => import("../components/Manage"));

export const Ps = loadableComponentFactory(() => import("../components/Ps"));

export const World = loadableComponentFactory(() => import("../world/World"));

function loadableComponentFactory<T extends () => Promise<any>>(input: T) {
  return {
    loadable: loadable(input),
    get:(module: Awaited<ReturnType<T>>) =>
      (props: React.ComponentProps<(typeof module)["default"]>) =>
        React.createElement(module.default, { disabled: true, ...props }),
  };
}
