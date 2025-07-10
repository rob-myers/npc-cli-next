"use client";
import React from "react";
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper/types';

import { Scrollbar } from 'swiper/modules';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/scrollbar';

export default function Carousel(props: Props) {

  const state = useStateRef(() => ({
    maximized: null as null | { slide: HTMLElement; baseWidth: number; },
    swiper: {} as SwiperClass,
    onSwiper: (api: SwiperClass) => state.swiper = api,
  }));

  return (
    <Swiper
      // centeredSlides={props.items.length <= 2}
      css={carouselCss}
      loop={false}
      modules={[Scrollbar]}
      onSwiper={state.onSwiper}
      scrollbar={{ draggable: true }}
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
  --slider-height: 100%;
  --slider-height-mobile: 100%;
  --slider-scrollbar-height: 48px;
  
  height: var(--slider-height);
  margin: 48px 0;
  background-color: #fff;
  
  @media (max-width: ${mobileBreakpoint}) {
    --slider-scrollbar-height: 40px;
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    height: calc(100% - var(--slider-scrollbar-height) - 4px);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .swiper-scrollbar {
    height: var(--slider-scrollbar-height);
    transform: scaleX(102%);
    display: flex;
    align-items: end;
    border-radius: 0;
    background-color: #000;
    
    div {
      height: 50%;
      border-radius: 0;
      background-color: #444;
    }
  }

`;
