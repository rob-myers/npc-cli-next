"use client";

import React from 'react';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { FontAwesomeIcon, faCopy } from './Icon';

/**
 * Usage: directly provide mdx code block as child,
 * in order for rehype to parse it.
 * 
 * 🚧 can copy all code to clipboard
 * 🚧 can copy line of code to clipboard
 * - e.g. by clicking line number, detected via click on line and relative position
 * - could select line rather than actually copy
 */
export default function Code({ children }: React.PropsWithChildren<Props>) {
  
  const state = useStateRef(() => ({
    container: null as null | HTMLDivElement,
    lines: [] as string[],
    async copyAll() {
      await navigator.clipboard.writeText(state.lines.join('\n'));
    },
  }));

  React.useEffect(() => {
    const spans = Array.from(state.container!.querySelectorAll('code > span')) as HTMLSpanElement[];
    state.lines = spans.map(el => el.innerText);
  }, []);

  return (
    <div ref={state.ref('container')} css={codeContainerCss}>
      <div
        className='copy-all'
        onClick={state.copyAll}
      >
      <FontAwesomeIcon icon={faCopy} />
      </div>
      {children}
    </div>
  );
}

interface Props {
  // 🚧
}

const codeContainerCss = css`
  position: relative;
  
  > .copy-all {
    position: absolute;
    top: calc( 32px );
    right: 0;
    height: 32px;
    padding: 0 16px;
    cursor: pointer;
    color: #ccc;
    font-size: large;
    
    &:hover, &:active {
      color: #fff;
    }
  }

  figure > div[data-rehype-pretty-code-title] {
    text-align: center;
  }

  code[data-line-numbers] {
    counter-reset: line;
  }
  code[data-line-numbers] > [data-line]::before {
    counter-increment: line;
    content: counter(line);
  
    display: inline-block;
    width: 0.75rem;
    margin-right: 2rem;
    text-align: right;
    color: gray;

    /* cursor: pointer; */
  }

  // selected line
  code > span[data-highlighted-line] {
    background-color: rgb(130, 130, 130, 0.5);
  }

  figcaption[data-rehype-pretty-code-caption] {
    text-align: center;
  }
`;
