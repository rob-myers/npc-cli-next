import React from 'react';
import { throttle } from 'throttle-debounce';

// https://github.com/vercel/next.js/discussions/33777#discussioncomment-2148021
export default function useRefreshScrollRestoration(scrollEl: HTMLElement | null) {
  React.useLayoutEffect(() => {
    if (scrollEl === null) {
      return;
    }

    const pageAccessedByReload = window.performance
      .getEntriesByType('navigation')
      .map((nav) => (nav as any).type)
      .includes('reload')
    ;

    if (pageAccessedByReload) {
      const scrollPosition = Number.parseInt(sessionStorage.getItem('scrollPosition') ?? '0', 10);
      if (scrollPosition) {
        scrollEl.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      }
    }

    const handleScroll = throttle(500, () => {
      sessionStorage.setItem('scrollPosition', String(scrollEl.scrollTop));
    });

    scrollEl.addEventListener('scroll', handleScroll);

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
    };
  }, [scrollEl]);
}
