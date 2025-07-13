import { pause } from '@/npc-cli/service/generic';
import React from 'react';
import { throttle } from 'throttle-debounce';

// https://github.com/vercel/next.js/discussions/33777#discussioncomment-2148021
export default function useRefreshScrollRestoration(scrollEl: HTMLElement | null) {
  React.useEffect(() => {
    if (scrollEl === null) {
      return;
    }

    const pageAccessedByReload = window.performance
      .getEntriesByType('navigation')
      .map((nav) => (nav as any).type)
      .includes('reload')
    ;

    const scrollStorageKey = `scrollTop:${window.location.pathname}`;

    if (pageAccessedByReload === true) {
      const scrollPosition = Number.parseInt(sessionStorage.getItem(scrollStorageKey) ?? '0', 10);
      if (typeof scrollPosition === 'number') {
        // delay needed on some pages
        // 🚧 await content loaded
        pause(500).then(() => scrollEl.scrollTo({ top: scrollPosition, behavior: 'smooth' }));
      }
    }

    const handleScroll = throttle(500, () =>
      sessionStorage.setItem(scrollStorageKey, String(scrollEl.scrollTop))
    );

    scrollEl.addEventListener('scroll', handleScroll);
    return () => {
       scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [scrollEl, scrollEl !== null ? window.location.pathname : null]);
}
