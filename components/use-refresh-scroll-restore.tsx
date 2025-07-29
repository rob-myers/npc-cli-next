import React from 'react';
import { throttle } from 'throttle-debounce';
import { pause } from '@/npc-cli/service/generic';

// https://github.com/vercel/next.js/discussions/33777#discussioncomment-2148021
export default function useRefreshScrollRestoration(scrollEl: HTMLElement | null) {
  React.useEffect(() => {
    if (scrollEl === null) {
      return;
    }

    // const navigationEntry = window.performance
    //   .getEntriesByType('navigation')
    //   .find((nav) => ['reload', 'back_forward', 'navigate'].includes((nav as any).type))
    // ;

    const scrollStorageKey = `scrollTop:${window.location.pathname}`;
    let userScrolled = false;

    const scrollPosition = Number.parseInt(sessionStorage.getItem(scrollStorageKey) ?? '0', 10);
    if (typeof scrollPosition === 'number') {
      // 🚧 await content loaded
      pause(500).then(() => {// ignore if already scrolled
        if (userScrolled === false) scrollEl.scrollTo({ top: scrollPosition, behavior: 'smooth' })
      });
    }

    const handleScroll = throttle(500, () => {
      sessionStorage.setItem(scrollStorageKey, String(scrollEl.scrollTop));
      userScrolled = true;
    });

    scrollEl.addEventListener('scroll', handleScroll);
    return () => {
       scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [scrollEl, scrollEl !== null ? window.location.pathname : null]);
}
