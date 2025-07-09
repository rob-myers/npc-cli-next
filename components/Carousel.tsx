"use client";
import React from "react";
import { Swiper, type SwiperProps, SwiperSlide } from 'swiper/react';
import type { NavigationOptions, PaginationOptions, Swiper as SwiperClass } from 'swiper/types';

import { Navigation, Pagination } from 'swiper/modules';
import { css } from '@emotion/react';

import { pause } from "@/npc-cli/service/generic";
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { faExpandThin, FontAwesomeIcon } from "@/npc-cli/components/Icon";
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function Carousel(props: Props) {

  if (props.items.length === 2) {
    // permit both original slides to be selected in loop,
    // although we don't handle general case
    props.items.push(<>This page intentionally left blank</>);
  }

  const state = useStateRef(() => ({
    maximized: null as null | { slide: HTMLElement; baseWidth: number; },
    navigationOpts: { enabled: true } as NavigationOptions,
    paginationOpts: { clickable: true, type: 'fraction', dynamicBullets: false } as PaginationOptions,
    swiper: {} as SwiperClass,

    onClick(e: React.MouseEvent) {
      const el = e.target as HTMLElement;
      if (
        el.closest('.options') !== null // inside options
        || state.maximized === null
        || el.closest('.swiper-slide') === state.maximized.slide
      ) {
        return;
      }
      state.toggleMaximized();
    },
    onSwiper: (api: SwiperClass) => state.swiper = api,
    toggleMaximized() {
      const { slides } = state.swiper;
      if (state.maximized !== null) {
        const { baseWidth } = state.maximized;
        // 🔔 can reset all
        slides.forEach(x => x.style.width = `${baseWidth}px`);
        state.maximized = null;
      } else {
        const { activeIndex, el } = state.swiper;
        const slideEl = slides[activeIndex];
        state.maximized = { slide: slideEl, baseWidth: slideEl.getBoundingClientRect().width };
        slideEl.style.width = `${el.getBoundingClientRect().width}px`;
      }
    },
  }), { reset: { navigationOpts: true, paginationOpts: true } });

  React.useEffect(() => {
    function onChangeSlide() {
      state.maximized !== null && state.toggleMaximized();
    }
    state.swiper.on('activeIndexChange', onChangeSlide);

    pause(500).then(() => {// remove delay
      state.swiper.el.style.setProperty('--slider-slide-animation-delay', '0ms');
    });

    return () => state.swiper.off('activeIndexChange', onChangeSlide);
  }, [])

  return (
    <div
      css={carouselContainerCss}
      onClick={state.onClick}
    >
      <Swiper
        breakpoints={props.breakpoints}
        // centeredSlides={props.items.length <= 2}
        css={carouselCss}
        loop={props.items.length > 2}
        modules={[Navigation, Pagination]}
        navigation={state.navigationOpts}
        onSwiper={state.onSwiper}
        pagination={state.paginationOpts}
        slidesPerView={props.slidesPerView ?? 1}
        spaceBetween={50}
        style={{
          ['--slider-height' as any]: `${props.height}px`,
          ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
        }}
      >
        {props.items.map((child, index) =>
          <SwiperSlide key={index}>
            {child}
          </SwiperSlide>
        )}
      </Swiper>

      <div className="options">
        <div className="option" onClick={state.toggleMaximized} data-side="left">
          <FontAwesomeIcon icon={faExpandThin} />
        </div>
      </div>
    </div>
  );
}

interface Props extends Pick<SwiperProps, (
  | 'slidesPerView'
  | 'breakpoints'
)> {
  height: number;
  heightMobile?: number;
  items: React.ReactElement[];
}


const carouselCss = css`
  --pagination-height: 48px;
  --slider-height: 100%;
  --slider-height-mobile: 100%;
  --slider-slide-animation-delay: 300ms;

  height: var(--slider-height);
  margin: 48px 0;
  background-color: #fff;
  
  @media (max-width: ${mobileBreakpoint}) {
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    height: calc(100% - var(--pagination-height));

    /* SSR "fix" */
    transition: width 300ms var(--slider-slide-animation-delay);

    display: flex;
    justify-content: center;
    align-items: center;
    
    border: 1px solid #9997;
    border-bottom: none;
  }
  
  .swiper-pagination {
    bottom: 0;
    
    display: flex;
    justify-content: center;
    align-items: center;
    height: var(--pagination-height);
    
    pointer-events: none;

    gap: 8px;
    @media (max-width: ${mobileBreakpoint}) {
      gap: 12px;
    }

    border: 1px solid #9997;
    background-color: white;
  }

`;

const carouselContainerCss = css`
  position: relative;

  .options {
    position: absolute;
    z-index: 2;
    bottom: 0;
    right: 0;
    height: 48px;

    display: flex;
    align-items: stretch;
    
    .option {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    svg {
      padding: 0 16px;
    }
  }

  @media (max-width: ${mobileBreakpoint}) {
    .options {
      display: none;
    }
  }

`;
