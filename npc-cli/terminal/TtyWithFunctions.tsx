import React from "react";

import { profile } from '../sh/src/profiles';

import utilSh from "../sh/src/util.sh";
import gameSh from "../sh/src/game.sh";

import * as util from '../sh/src/util';
import * as game from '../sh/src/game';
import * as game_1 from '../sh/src/game_1';

import Tty, { type Props as TtyProps } from "./Tty";

/**
 * Using a separate file permits hot-module reloading,
 * without triggering the terminal's various useEffects.
 * 
 * We remount onchange profileKey.
 */
export default function TtyWithFunctions(props: Props) {
  return (
    <Tty
      key={props.profileKey}
      {...props}
      jsFunc={keyedJsModules}
      shFiles={shellFunctionFiles}
      profile={profile[props.profileKey]}
    />
  );
}

interface Props extends Omit<TtyProps, 'shFiles' | 'profile' | 'jsFunc'> {
  profileKey: Key.Profile;
}

/** Each value is a string i.e. shell code. */
const keyedShFiles = {
  utilSh,
  gameSh,
};

/**
 * These files contain JS (async) generators and functions.
 * - They will be converted into shell functions.
 * - We also store them directly in session.
 */
const keyedJsModules = {
  util,
  game,
  game_1,
};

export type TtyJsModules = typeof keyedJsModules;

/**
 * Keys of basenames of files in /etc.
 */
export type EtcBasename = FileKeyToEtcBasename<(
  | keyof typeof keyedShFiles
  | keyof typeof keyedJsModules
)>
type FileKeyToEtcBasename<S extends string> = S extends `${infer T}Sh`
  ? `${T}.sh`
  : `${S}.js.sh`;

const shellFunctionFiles = {

  ...Object.entries(keyedShFiles).reduce((agg, [key, rawModule]) => ({ ...agg,
    [`${key.slice(0, -'Sh'.length)}.sh`]: rawModule,
  }), {} as Record<EtcBasename, string>),

  ...Object.entries(keyedJsModules).reduce((agg, [moduleKey, module]) => ({ ...agg,
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
  return `${fnKey}() ${
    generatorConstructorNames.includes(fn.constructor.name)
      ? `{\n  run ${moduleKey} ${fnKey} "$@"\n}`
      : fn.constructor.name === 'Function' && !fn.toString().startsWith('function')
        // const foo = (..args) => bar
        ? `{\n  call ${moduleKey} ${fnKey} "$@"\n}`
        // assume 'AsyncFunction' or 'Function'
        : `{\n  map ${moduleKey} ${fnKey} "$@"\n}`
  }`;
}
