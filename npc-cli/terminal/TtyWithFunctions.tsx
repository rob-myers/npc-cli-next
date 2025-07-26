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

/**
 * Keys of basenames of files in /etc.
 */
export type EtcBasename = FileKeyToEtcBasename<(
  | keyof typeof scripts
  | keyof typeof modules
)>
type FileKeyToEtcBasename<S extends string> = S extends `${infer T}Sh`
  ? `${T}.sh`
  : `${S}.js.sh`;

const shellFunctionFiles = {

  ...Object.entries(scripts).reduce((agg, [key, rawModule]) => ({ ...agg,
    [`${key.slice(0, -'Sh'.length)}.sh`]: rawModule,
  }), {} as Record<EtcBasename, string>),

  ...Object.entries(modules).reduce((agg, [moduleKey, module]) => ({ ...agg,
    [`${moduleKey}.js.sh`]: Object.entries(module).map(
      ([fnKey, fn]) => jsFunctionToShellFunction(moduleKey, fnKey, fn)
    ).join('\n\n'),
  }), {} as Record<EtcBasename, string>),

};

export type TtyEtcFiles = typeof shellFunctionFiles;

function jsFunctionToShellFunction(
  moduleKey: string,
  fnKey: string,
  fn: (
    | ((arg: NPC.RunArg) => any)
    | ((input: any, arg: NPC.RunArg) => any)
  ),
) {
  const generatorConstructorNames = [
    'AsyncGeneratorFunction',
    'GeneratorFunction',
  ];
  const functionConstructorNames = [
    'Function',
    'AsyncFunction',
  ];
  return `${fnKey}() ${
    generatorConstructorNames.includes(fn.constructor.name)
      // function* foo { bar }
      // async function* foo { bar }
      ? `{\n  run ${moduleKey} ${fnKey} "$@"\n}`
      : functionConstructorNames.includes(fn.constructor.name) && !fn.toString().startsWith('function')
        // const foo = (..args) => bar
        // const foo = async (..args) => bar
        ? `{\n  run ${moduleKey} ${fnKey} "$@"\n}`
        // function foo { bar }
        // async function foo { bar }
        : `{\n  map ${moduleKey} ${fnKey} "$@"\n}`
  }`;
}
