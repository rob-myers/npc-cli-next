"use client";
import React from "react";
import { Swiper, SwiperSlide } from 'swiper/react';
import type { NavigationOptions, PaginationOptions, Swiper as SwiperClass } from 'swiper/types';

import { Navigation, Pagination } from 'swiper/modules';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function Carousel(props: Props) {

  const state = useStateRef(() => ({
    maximized: null as null | { slide: HTMLElement; baseWidth: number; },
    navigationOpts: { enabled: true } as NavigationOptions,
    paginationOpts: { clickable: true, type: 'fraction', dynamicBullets: false } as PaginationOptions,
    swiper: {} as SwiperClass,
    onSwiper: (api: SwiperClass) => state.swiper = api,
  }), { reset: { navigationOpts: true, paginationOpts: true } });

  return (
    <Swiper
      // centeredSlides={props.items.length <= 2}
      css={carouselCss}
      loop={props.items.length > 2}
      modules={[Navigation, Pagination]}
      navigation={state.navigationOpts}
      onSwiper={state.onSwiper}
      pagination={state.paginationOpts}
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
  --pagination-height: 48px;
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
  
  .swiper-pagination {
    bottom: 0;
    
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    
    height: var(--pagination-height);
    
    pointer-events: none;
    border: 1px solid #9997;
    background-color: white;
  }

`;
