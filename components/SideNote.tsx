"use client"
import React from 'react';
import cx from 'classnames';
import { css } from '@emotion/react';
import { sideNoteRootDataAttribute } from './const';

/**
 * - Direction is `right` unless < 200 pixels to the right of
 *   root element, in which case direction is `left`
 */
export default function SideNote(props: React.PropsWithChildren<Props>) {
  const timeoutId = React.useRef(0);

  return <>
    <span
      css={iconTriggerCss}
      className={cx("side-note", props.className)}
      onClick={e => 
        open({
          bubble: e.currentTarget.nextSibling as HTMLElement,
          props,
          rect: e.currentTarget.getBoundingClientRect(),
          timeoutId: timeoutId.current,
        })
      }
      onMouseEnter={e => {
        const bubble = e.currentTarget.nextSibling as HTMLElement;
        const rect = e.currentTarget.getBoundingClientRect();
        timeoutId.current = window.setTimeout(() => open({
          bubble,
          props,
          rect,
          timeoutId: timeoutId.current,
        }), hoverShowMs);
      }}
      onMouseLeave={e => {
        window.clearTimeout(timeoutId.current); // clear hover timeout
        timeoutId.current = close(e, 'icon', props.onClose);
      }}
    >
      {props.trigger ?? '⋯'}
    </span>
    <span
      css={speechBubbleCss}
      className={cx("side-note-bubble", props.bubbleClassName)}
      onMouseEnter={_ => window.clearTimeout(timeoutId.current)}
      onMouseLeave={e => (timeoutId.current = close(e, 'bubble', props.onClose))} // Triggered on mobile click outside
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
}

interface Props {
  bubbleClassName?: string; 
  className?: string; 
  onClose?(): void;
  padding?: string | number;
  trigger?: React.ReactNode;
  width?: number;
}

function open({
  bubble,
  props: { padding, width },
  rect,
  timeoutId,
}: OpenOpts) {
  window.clearTimeout(timeoutId); // clear close timeout

  bubble.classList.add('open');
  
  const root = document.querySelector(`[${sideNoteRootDataAttribute}]`) ?? document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const pixelsOnRight = rootRect.right - rect.right;
  const pixelsOnLeft = rect.x - rootRect.x;
  bubble.classList.remove('left', 'right', 'down');
  bubble.classList.add(pixelsOnRight < pixelsOnLeft ? 'left' : 'right');
  
  const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
  width = maxWidthAvailable < (width ?? defaultInfoWidthPx) ? maxWidthAvailable : width;
  if (width !== undefined) {
    width = Math.max(width, minInfoWidth);
    bubble.style.setProperty('--info-width', `${width}px`);
  }
  bubble.style.setProperty(
    '--info-padding',
    typeof padding === 'string' ? padding : `${padding ?? defaultInfoPaddingPx}px`,
  );
}

interface OpenOpts {
  bubble: HTMLElement;
  rect: DOMRect;
  timeoutId: number;
  props: Props;
}

function close(e: React.MouseEvent, source: 'icon' | 'bubble', onClose?: () => void) {
  const bubble = (source === 'icon' ? e.currentTarget.nextSibling : e.currentTarget) as HTMLElement;
  return window.setTimeout(() => {
    bubble.classList.remove('open', 'left', 'right', 'down');
    bubble.style.removeProperty('--info-width');
    onClose?.();
  }, 100);
}

const defaultInfoWidthPx = 300;
const defaultInfoPaddingPx = 16;
const rootWidthPx = 16;
const arrowDeltaX = 4;

const iconTriggerCss = css`
  width: ${rootWidthPx}px;
  cursor: pointer;
  white-space: nowrap;
  
  padding: 0 4px;
  margin-left: 2px;
  border-radius: 10px;
  border: 1px solid #aaaaaa;
  background-color: white;
  color: black;
  font-size: 0.95rem;
  font-style: normal;
`;

const speechBubbleCss = css`
  --info-width: ${defaultInfoWidthPx}px;
  --info-padding: ${defaultInfoPaddingPx}px;

  position: relative;
  top: ${-rootWidthPx}px;
  /** Prevents bubble span from wrapping to next line? */
  display: inline-block;

  font-size: 0.95rem;
  font-style: normal;
  text-align: center;
  white-space: nowrap;

  &.open .arrow,
  &.open .info
  {
    visibility: visible;
  }
  &:not(.open) .info {
    right: 0; // prevent overflow scroll
  }

  .info {
    position: absolute;
    z-index: 1;

    visibility: hidden;
    white-space: normal;
    width: var(--info-width);
    margin-left: calc(-0.5 * var(--info-width));
    padding: var(--info-padding);
    line-height: 1.6;

    background-color: black;
    color: white;
    border-radius: 4px;
    border: 2px solid #444;

    a {
      color: #dd0;
    }
    code {
      font-size: inherit;
    }
  }
  .arrow {
    visibility: hidden;
    position: absolute;
    width: 0; 
    height: 0;
  }

  &.left {
    left: ${-1.5 * rootWidthPx}px;
    .info {
      top: -4px;
      left: calc(-1 * (0.5 * var(--info-width) + ${arrowDeltaX}px ));
    }
    .arrow {
      top: 0;
      left: -${arrowDeltaX}px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid #444;
    }
  }
  &.right {
    left: ${-rootWidthPx}px;
    .info {
      top: -4px;
      left: calc(${rootWidthPx}px + 0.5 * var(--info-width) + ${arrowDeltaX}px);
    }
    .arrow {
      top: 0;
      left: ${rootWidthPx/2 + arrowDeltaX}px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 10px solid #444;
    }
  }
  &.down {
    .info {
      top: 20px;
    }
    .arrow {
      top: calc(-10px + 20px);
      left: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid #444;
    }
  }
`;

const hoverShowMs = 500;
const minInfoWidth = 100;
