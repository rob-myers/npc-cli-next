import React from "react";

import * as profiles from '../sh/profiles';
/**
 * Each keyed module contains JS generators and functions.
 * - They will be converted into shell functions.
 * - We also store them directly in session.
 */
import * as modules from '../sh/modules';
/**
 * Each keyed value is a string i.e. shell code.
 */
import * as scripts from '../sh/scripts';

import Tty, { type Props as TtyProps } from "./Tty";

/**
 * Using a separate file permits hot-module reloading,
 * without triggering the terminal's various useEffects.
 * 
 * We remount `<Tty>` onchange profileKey.
 */
export default function TtyWithFunctions(props: Props) {
  return (
    <Tty
      key={props.profileKey}
      {...props}
      jsFunc={modules}
      shFiles={shellFunctionFiles}
      profile={profiles[props.profileKey]}
    />
  );
}

interface Props extends Omit<TtyProps, 'shFiles' | 'profile' | 'jsFunc'> {
  profileKey: Key.Profile;
}

export type TtyJsModules = typeof modules;
type TtyJsModuleKey = keyof TtyJsModules;

/**
 * Keys of basenames of files in /etc.
 */
export type EtcBasename = FileKeyToEtcBasename<(
  | keyof typeof scripts
  | TtyJsModuleKey
)>
type FileKeyToEtcBasename<S extends string> = S extends `${infer T}Sh`
  ? `${T}.sh`
  : `${S}.js.sh`;

const shellFunctionFiles = {

  ...Object.entries(scripts).reduce((agg, [key, rawModule]) => ({ ...agg,
    [`${key.slice(0, -'Sh'.length)}.sh`]: rawModule,
  }), {} as Record<EtcBasename, string>),

  ...Object.entries(modules).reduce((agg, [moduleKey, module]) => ({ ...agg,
    [`${moduleKey}.js.sh`]: Object.entries(module).flatMap(
      // exclude non-function exports
      ([fnKey, fn]) => typeof fn === 'function' ? jsFunctionToShellFunction(
        moduleKey as TtyJsModuleKey,
        fnKey,
        fn as TtyJsFuncType,
      ) : [],
    ).join('\n\n'),
  }), {} as Record<EtcBasename, string>),

};

export type TtyEtcFiles = typeof shellFunctionFiles;

function jsFunctionToShellFunction(
  moduleKey: keyof typeof modules,
  fnKey: string,
  fn: TtyJsFuncType,
) {
  const jsModule = modules[moduleKey] as ModuleMaybeMeta;
  const generatorConstructorNames = [
    'AsyncGeneratorFunction',
    'GeneratorFunction',
  ];
  return `${fnKey}() ${
    generatorConstructorNames.includes(fn.constructor.name)
      // function* foo { bar }
      // async function* foo { bar }
      ? `{\n  run ${moduleKey} ${fnKey} "$@"\n}`
      : isMappedFunction(jsModule, fn)
        ? `{\n  map ${moduleKey} ${fnKey} "$@"\n}`
        : `{\n  run ${moduleKey} ${fnKey} "$@"\n}`
  }`;
}

/**
 * A non-generator JS function should be `map`d if:
 * - it is not an arrow function
 * - if `module.meta` exists then it is listed.
 * 
 * 🔔 SWC sometimes transpiles arrow functions to functions
 */
function isMappedFunction(
  module: ModuleMaybeMeta,
  fn: (
    | ((arg: NPC.RunArg) => any)
    | ((input: any, arg: NPC.RunArg) => any)
  ),
) {
  const functionConstructorNames = [
    'Function',
    'AsyncFunction',
  ];
  if (
    functionConstructorNames.includes(fn.constructor.name)
    && !fn.toString().startsWith('function')
  ) {
    // const foo = (..args) => bar
    // const foo = async (..args) => bar
    return false;
  }
  if (module.meta) {
    return fn.name in module.meta.map;
  }
  return true;
}

type ModuleMaybeMeta = {
  meta?: {
    map: Meta;
  };
};

type TtyJsFuncType = (
  | ((arg: NPC.RunArg) => any)
  | ((input: any, arg: NPC.RunArg) => any)
);
