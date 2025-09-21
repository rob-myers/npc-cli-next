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

import jsFunctionToShellFunction from "../sh/js-to-shell-function";
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
      modules={modules}
      shFiles={shellFunctionFiles}
      profile={profiles[props.profileKey]}
    />
  );
}

interface Props extends Omit<TtyProps, 'shFiles' | 'profile' | 'modules'> {
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
)>;

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
      ([fnKey, fn]) => typeof fn === 'function' ? jsFunctionToShellFunction({
        modules,
        moduleKey,
        fnKey,
        fn,
      }) : [],
    ).join('\n\n'),
  }), {} as Record<EtcBasename, string>),

};

export type TtyEtcFiles = typeof shellFunctionFiles;
