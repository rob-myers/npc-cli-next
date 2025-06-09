import React from "react";

import { profile } from '../sh/src/profiles';

import utilSh from "../sh/src/util.sh";
import gameSh from "../sh/src/game.sh";

import * as util from '../sh/src/util';
import * as game from '../sh/src/game';
import * as gameWip from '../sh/src/game-wip';

import Tty, { type Props as TtyProps } from "./Tty";

/**
 * Using a separate file permits hot-module reloading,
 * without triggering the terminal's various useEffects.
 */
export default function TtyWithFunctions(props: Props) {
  return (
    <Tty
      {...props}
      jsFunctions={jsFunctions}
      shFiles={shellFunctionFiles}
      profile={profile[props.profileKey]}
    />
  );
}

interface Props extends Omit<TtyProps, 'shFiles' | 'profile' | 'jsFunctions'> {
  profileKey: Key.Profile;
}

// we also provide functions directly
const jsFunctions = {
  gameWip,
  game,
  util,
};

export type TtyJsFunctions = typeof jsFunctions;

const generatorConstructorNames = ['AsyncGeneratorFunction', 'GeneratorFunction'];

const shellFunctionFiles = {

  ...Object.entries({
    
    // these files contain shell functions
    utilSh,
    gameSh,

  }).reduce((agg, [key, rawModule]) => ({ ...agg,
    [`${key.slice(0, -'Sh'.length)}.sh`]: rawModule,
  }), {} as Record<string, string>),

  ...Object.entries({
    
    // these files contain JS (async) generators and functions
    util,
    game,
    gameWip,

  }).reduce((agg, [key, module]) => ({ ...agg,
    [`${key}.jsh`]: Object.entries(module).map(
      ([key, fn]) => jsFunctionToShellFunction(key, fn)
    ).join('\n\n'),
  }), {} as Record<string, string>),

};

/**
 * 🔔 SWC is minifying the inner JavaScript functions in production,
 * and we don't seem to be able to exclude e.g. game.jsh
 */
function jsFunctionToShellFunction(
  functionName: string,
  fn: (
    | ((arg: NPC.RunArg) => any)
    | ((input: any, arg: NPC.RunArg) => any)
  ),
) {
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
