"use client";
import React from "react";
import { Swiper, SwiperProps, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper/types';

import { Scrollbar, Navigation, EffectFade, EffectCoverflow } from 'swiper/modules';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/scrollbar';
import 'swiper/css/effect-fade';
import 'swiper/css/effect-coverflow';

export default function Carousel(props: React.PropsWithChildren<Props>) {

  const state = useStateRef(() => ({
    maximized: null as null | { slide: HTMLElement; baseWidth: number; },
    swiper: {} as SwiperClass,
    onSwiper: (api: SwiperClass) => state.swiper = api,
  }));

  return (
    <Swiper
      css={carouselCss}
      loop={false}
      allowTouchMove={props.allowTouchMove}
      modules={[Scrollbar, Navigation, EffectFade, EffectCoverflow]}
      navigation={props.navigation}
      onSwiper={state.onSwiper}
      scrollbar={props.scrollbar ? { draggable: true } : undefined}
      slidesPerView={1}
      spaceBetween={50}
      effect={props.effect}
      style={{
        ['--slider-height' as any]: `${props.height}px`,
        ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
        ['--slider-scrollbar-height' as any]: props.scrollbar ? undefined : `${0}px`,
        background: props.background,
        border: props.border,
      }}
    >
      {React.Children.toArray(props.children).map((child, index) =>
        <SwiperSlide key={index} data-id={index}>
          {child}
        </SwiperSlide>
      )}
    </Swiper>
  );
}

interface Props extends Pick<SwiperProps, 'allowTouchMove' | 'navigation'> {
  background?: string;
  border?: string;
  height: number;
  heightMobile?: number;
  scrollbar?: boolean;
  effect?: 'fade' | 'slide' | 'coverflow';
}


const carouselCss = css`
  --slider-height: 100%;
  --slider-height-mobile: 100%;
  --slider-scrollbar-height: 48px;
  
  height: var(--slider-height);
  margin: 32px 0;

  --swiper-navigation-size: 24px !important;

  @media (max-width: ${mobileBreakpoint}) {
    --slider-scrollbar-height: 32px;
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    /* height: calc(100% - var(--slider-scrollbar-height) - 4px); */
    height: calc(100% - var(--slider-scrollbar-height));
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .swiper-scrollbar {
    height: var(--slider-scrollbar-height);
    transform: scaleX(102%) translate(0, 4px);
    display: flex;
    align-items: end;
    border-radius: 0;
    background-color: #000;
    cursor: grab;
    
    @keyframes fadeScrollBarIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    
    div {
      height: 50%;
      border-radius: 0;
      border: 1px solid white;
      background-color: #777;
      animation: fadeIn 1s forwards;
    }
  }

`;
