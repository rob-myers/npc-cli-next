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
 */
export default function TtyWithFunctions(props: Props) {
  return (
    <Tty
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

  ...Object.entries(keyedJsModules).reduce((agg, [key, module]) => ({ ...agg,
    [`${key}.js.sh`]: Object.entries(module).map(
      ([key, fn]) => jsFunctionToShellFunction(key, fn)
    ).join('\n\n'),
  }), {} as Record<EtcBasename, string>),

};

export type TtyEtcFiles = typeof shellFunctionFiles;

/**
 * 🔔 SWC is minifying the inner JavaScript functions in production,
 * and we don't seem to be able to exclude e.g. game.js.sh
 */
function jsFunctionToShellFunction(
  functionName: string,
  fn: (
    | ((arg: NPC.RunArg) => any)
    | ((input: any, arg: NPC.RunArg) => any)
  ),
) {
  const generatorConstructorNames = [
    'AsyncGeneratorFunction',
    'GeneratorFunction',
  ];
  return `${functionName}() ${
    generatorConstructorNames.includes(fn.constructor.name)
      ? wrapWithRun(fn as AsyncGeneratorFunction)
      // : fn.constructor.name === 'Function' && fn.toString().startsWith('(')
      : fn.constructor.name === 'Function' && !fn.toString().startsWith('function')
        // const foo = (..args) => bar
        ? wrapWithCall(fn as ((arg: NPC.RunArg) => any))
        // assume 'AsyncFunction' or 'Function'
        : wrapWithMap(fn as ((input: any, arg: NPC.RunArg) => any))
  }`;
}

function wrapWithRun(fn: (arg: NPC.RunArg) => any) {
  // 🔔 support single-quotes via (a) escaping, (b) bash-syntax $'...'
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  run $'${fnText.slice(fnText.indexOf('('))}\n' "$@"\n}`;
}

function wrapWithCall(fn: (arg: NPC.RunArg) => any) {
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  call $'${fnText}' "$@"\n}`;
}

function wrapWithMap(fn: (input: any, arg: NPC.RunArg) => any) {
  const fnText = `${fn}`.replace(/'/g, "\\'");
  return `{\n  map $'${fnText}' "$@"\n}`;
}
