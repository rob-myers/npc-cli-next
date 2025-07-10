"use client";
import React from "react";
import { Swiper, SwiperSlide } from 'swiper/react';
import type { NavigationOptions, Swiper as SwiperClass } from 'swiper/types';

import { Navigation, Pagination, Scrollbar } from 'swiper/modules';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/scrollbar';

export default function Carousel(props: Props) {

  const state = useStateRef(() => ({
    maximized: null as null | { slide: HTMLElement; baseWidth: number; },
    navigationOpts: { enabled: true } as NavigationOptions,
    swiper: {} as SwiperClass,
    onSwiper: (api: SwiperClass) => state.swiper = api,
  }), { reset: { navigationOpts: true } });

  return (
    <Swiper
      // centeredSlides={props.items.length <= 2}
      css={carouselCss}
      loop={false}
      modules={[Navigation, Pagination, Scrollbar]}
      navigation={state.navigationOpts}
      onSwiper={state.onSwiper}
      scrollbar={{ draggable: true,  }}
      slidesPerView={1}
      spaceBetween={50}
      style={{
        ['--slider-height' as any]: `${props.height}px`,
        ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
      }}
    >
      {props.items.map((child, index) =>
        <SwiperSlide key={index} data-id={index}>
          {child}
        </SwiperSlide>
      )}
    </Swiper>
  );
}

interface Props {
  height: number;
  heightMobile?: number;
  items: React.ReactElement[];
}


const carouselCss = css`
  --pagination-height: 64px;
  --slider-height: 100%;
  --slider-height-mobile: 100%;

  height: var(--slider-height);
  margin: 48px 0;
  background-color: #fff;
  
  @media (max-width: ${mobileBreakpoint}) {
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    height: calc(100% - var(--pagination-height));

    display: flex;
    justify-content: center;
    align-items: center;
    
    border: 1px solid #9997;
    border-bottom: none;
  }

  .swiper-button-prev, .swiper-button-next {
    padding: 0 32px;
  }
  
  .swiper-scrollbar {
    height: 40px;
    transform: scaleX(102%);

    div {
      background-color: white;
      border: 1px solid #777a;
    }
  }

`;
