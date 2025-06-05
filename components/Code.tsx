"use client";

import React from 'react';
import { css } from '@emotion/react';
import useStateRef from '@/npc-cli/hooks/use-state-ref';

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
  }));

  React.useEffect(() => {
    const spans = Array.from(state.container!.querySelectorAll('code > span')) as HTMLSpanElement[];
    const lines = spans.map(el => el.innerText);
    console.log({lines});
  }, []);

  return (
    <div ref={state.ref('container')} css={codeContainerCss}>
      {children}
    </div>
  );
}

interface Props {
  // 🚧
}

const codeContainerCss = css`
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
