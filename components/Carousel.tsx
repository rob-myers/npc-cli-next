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
      slidesPerView={1}
      spaceBetween={50}
      effect={props.effect}
      style={{
        ['--slider-height' as any]: `${props.height}px`,
        ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
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
  effect?: 'fade' | 'slide' | 'coverflow';
}


const carouselCss = css`
  --slider-height: 100%;
  --slider-height-mobile: 100%;
  
  height: var(--slider-height);
  margin: 48px 0;
  --swiper-navigation-color: #88f;
  
  @media (max-width: ${mobileBreakpoint}) {
    --swiper-navigation-size: 24px !important;
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  

`;
