"use client";

import React from 'react';
import { css } from '@emotion/react';

import { sideNoteRootDataAttribute } from './const';
import { pause } from '@/npc-cli/service/generic';
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useUpdate from '@/npc-cli/hooks/use-update';
import { FontAwesomeIcon, faCopy } from './Icon';
import SideNote from './SideNote';

/**
 * Usage: directly provide mdx code block as child,
 * in order for rehype to parse it.
 */
export default function Code({ children }: React.PropsWithChildren<Props>) {
  
  const state = useStateRef(() => ({
    container: null as null | HTMLDivElement,
    copyIndicatorText: copyIndication.preCopyAll,
    lines: [] as string[],
    openCopyText: undefined as undefined | boolean,

    async copyAll() {
      try {
        await navigator.clipboard.writeText(state.lines.join('\n'));
        state.copyIndicatorText = copyIndication.success;
      } catch (e) {
        console.error(e);
        state.copyIndicatorText = copyIndication.failure;
      }
      update();
    },
    async onClick(e: React.PointerEvent<HTMLDivElement> & { target: HTMLElement }) {
      const { target: el } = e;
      if (el.matches('[data-line]')) {
        // copy single line
        const index = Array.from(el.parentElement?.children ?? []).indexOf(el);
        await navigator.clipboard.writeText(state.lines[index]);
        // visual representation
        state.openCopyText = true;
        state.copyIndicatorText = copyIndication.postCopyLine;
        update();
        await pause(2000);
        state.openCopyText = undefined;
        update();
      }
    },
    resetCopyText() {
      state.copyIndicatorText = copyIndication.preCopyAll;
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
        icon={<FontAwesomeIcon icon={faCopy} />}
        onClose={state.resetCopyText}
        open={state.openCopyText}
        width={120}
      >
        {state.copyIndicatorText}
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
      transform: translate(-16px, -4px);
      .info {
        padding: 4px 8px;
      }
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

const copyIndication = {
  failure: 'Copy failed.',
  preCopyAll: 'Copy all?',
  postCopyLine: 'Copied line',
  success: 'Copied!',
};
