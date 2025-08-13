"use client";

import React from 'react';
import { css } from '@emotion/react';

import { sideNoteRootDataAttribute } from './const';
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useUpdate from '@/npc-cli/hooks/use-update';
import { FontAwesomeIcon, faCopy } from '../npc-cli/components/Icon';
import SideNote from './SideNote';
import { documentHasSelection } from '@/npc-cli/service/dom';

/**
 * Usage: directly provide mdx code block as child,
 * in order for rehype to parse it.
 */
export default function Code(props: React.PropsWithChildren<Props>) {

  const state = useStateRef(() => ({
    container: null as null | HTMLDivElement,
    copyIndicatorText: copyIndication.preCopyAll,
    /** Text was selected on last pointer down */
    hadSelection: false,
    hideTimeoutId: 0,
    lines: [] as string[],
    openCopyText: undefined as undefined | boolean,

    async copyAllLines() {
      try {
        await navigator.clipboard.writeText(state.lines.join('\n'));
        state.copyIndicatorText = copyIndication.success;
      } catch (e) {
        console.error(e);
        state.copyIndicatorText = copyIndication.failure;
      }
      update();
    },
    async copySomeLines(lines: string[]) {
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        await state.indicateLineCopied(lines.length);
      } catch (e) {
        console.error(e);
        state.copyIndicatorText = copyIndication.failure;
        update();
      }
    },
    async indicateLineCopied(numLines: number) {
      state.openCopyText = true;
      state.copyIndicatorText = numLines === 1 ? copyIndication.postCopyLine : copyIndication.postCopyLines;
      update();
      window.clearTimeout(state.hideTimeoutId);
      state.hideTimeoutId = window.setTimeout(() => {
        state.openCopyText = undefined;
        update();
      }, 2000);
    },
    async onClick(e: React.PointerEvent<HTMLDivElement> & { target: HTMLElement }) {
      const lineEl = e.target.closest('[data-line]');

      if (lineEl === null || documentHasSelection() || state.hadSelection === true) {
        return;
      }

      const lineEls = Array.from(lineEl.parentElement!.children);
      const index = lineEls.indexOf(lineEl);

      if (state.lines[index].trim().length === 0) {
        return;
      }

      const lines = [] as string[];
      for (let i = index; i < lineEls.length; i++) {
        const line = state.lines[i];
        lines.push(line);
        if (!(line.at(-1) === '\\' || line.at(-1) === '|')) {
          break;
        }
      }

      await state.copySomeLines(lines);
    },
    async onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      state.hadSelection = documentHasSelection();
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
      onPointerDown={state.onPointerDown}
      {...{ [sideNoteRootDataAttribute]: true }}
      // className="not-prose"
    >
      <figcaption>
        <div
          className='copy-all'
          onClick={state.copyAllLines}
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
        {props.title}
      </figcaption>

      {props.children}

    </div>
  );
}

interface Props {
  title?: string;
}

const codeContainerCss = css`
  width: 100%;
  height: 100%;
  overflow: auto;
  margin: 32px 0;
  
  figcaption {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 1rem;
    margin-top: 0;
    margin-bottom: 0;
    border: 1px solid #ddd;
    border-bottom: none;
    color: #000;
    height: 50px;
  }
  figure {
    margin-top: 0;
    margin-bottom: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    border-top: none;
  }
  pre {
    padding-top: 1rem;
    flex: 1;
    display: flex;
  }

  figcaption .copy-all {
    position: absolute;
    top: 0;
    right: 0;
    color: #ccc;
    font-size: large;
    cursor: pointer;
    
    &:hover, &:active {
      color: #fff;
    }
    
    .copy-all-side-note {
      display: inline-flex;
      width: 50px;
      height: 50px;
      justify-content: center;
      align-items: center;

      border-radius: 0;
      border: none;
      background-color: unset;
      color: black;
    }

    .copy-all-bubble {
      transform: translate(-24px, -4px);
      .info {
        padding: 4px 8px;
        border: none;
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

    @media (max-width: 500px) {
      font-size: medium;
    }
  }

  code[data-line-numbers] > span[data-line] {
    &::before {
      cursor: pointer;
    }
    &:hover::before, &:focus::before {
      /* color: white; */
      color: black;
      font-weight: 700;
    }
  }

  /* code::selection {
    background-color: rgba(180, 180, 255, 0.15);
  } */

  // selected line
  code > span[data-highlighted-line] {
    background-color: rgb(130, 130, 130, 0.5);
  }

  div[data-rehype-pretty-code-title] {
    margin-bottom: 4px;
  }

  figcaption[data-rehype-pretty-code-caption] {
    text-align: center;
  }
`;

const copyIndication = {
  failure: 'Copy failed.',
  preCopyAll: 'Copy all?',
  postCopyLine: 'Copied line',
  postCopyLines: 'Copied lines',
  success: 'Copied!',
};
