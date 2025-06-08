"use client";

import React from 'react';
import { css } from '@emotion/react';

import { sideNoteRootDataAttribute } from './const';
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useUpdate from '@/npc-cli/hooks/use-update';
import { FontAwesomeIcon, faCopy } from './Icon';
import SideNote from './SideNote';

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
    copyAllText: copyText.initialAll,
    lines: [] as string[],

    async copyAll() {
      try {
        await navigator.clipboard.writeText(state.lines.join('\n'));
        state.copyAllText = copyText.success;
      } catch (e) {
        console.error(e);
        state.copyAllText = copyText.failure;
      }
      update();
    },
    async onClick({ target: el }: React.PointerEvent<HTMLDivElement> & { target: HTMLElement }) {
      if (el.matches('[data-line]')) {
        const index = Array.from(el.parentElement?.children ?? []).indexOf(el);
        await navigator.clipboard.writeText(state.lines[index]);
      }
    },
    resetCopyText() {
      state.copyAllText = copyText.initialAll;
      update();
    },
  }));

  const update = useUpdate();

  React.useEffect(() => {
    const spans = Array.from(state.container!.querySelectorAll('code > span')) as HTMLSpanElement[];
    state.lines = spans.map(el => el.innerText);
  }, []);

  return (
    <div
      ref={state.ref('container')}
      css={codeContainerCss}
      onClick={state.onClick}
      {...{ [sideNoteRootDataAttribute]: true }}
    >
      <div
        className='copy-all'
        onClick={state.copyAll}
      >
      <SideNote
        bubbleClassName="copy-all-bubble"
        className="copy-all-side-note"
        onClose={state.resetCopyText}
        padding='4px 8px'
        trigger={<FontAwesomeIcon icon={faCopy} />}
        width={100}
      >
        {state.copyAllText}
      </SideNote>
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
    top: calc( 32px - 4px );
    right: 0;
    height: 32px;
    cursor: pointer;
    color: #ccc;
    font-size: large;
    
    &:hover, &:active {
      color: #fff;
    }

    .copy-all-side-note {
      display: inline-flex;
      width: 40px;
      height: 32px;
      justify-content: center;
      align-items: center;
      border-color: #999;
      border-width: 2px;
      border-radius: 0;
    }
    .copy-all-bubble {
      transform: translateX(-16px);
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

  }
  code[data-line-numbers] > span[data-line] {
    &::before {
      cursor: pointer;
    }
    &:hover::before, &:focus::before {
      color: white;
    }
  }

  // selected line
  code > span[data-highlighted-line] {
    background-color: rgb(130, 130, 130, 0.5);
  }

  figcaption[data-rehype-pretty-code-caption] {
    text-align: center;
  }
`;

const copyText = {
  initialAll: 'Copy all',
  success: 'Copied!',
  failure: 'Copy failed.',
};
