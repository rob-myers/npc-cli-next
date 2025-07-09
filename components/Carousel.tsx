"use client";
import { Swiper, type SwiperProps, SwiperSlide } from 'swiper/react';
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
    navigationOpts: { enabled: true } as NavigationOptions,
    paginationOpts: { clickable: true, type: 'fraction', dynamicBullets: false } as PaginationOptions,
    swiper: {} as SwiperClass,
    onSwiper: (api: SwiperClass) => state.swiper = api,
  }), { reset: { navigationOpts: true, paginationOpts: true } });

  return (
    <Swiper
      breakpoints={props.breakpoints}
      centeredSlides={props.items.length === 2}
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
  --slider-height: unset;
  --slider-height-mobile: unset;

  height: var(--slider-height);
  margin: 48px 0;
  
  @media (max-width: ${mobileBreakpoint}) {
    height: var(--slider-height-mobile);
    margin: 32px 0;
  }

  .swiper-slide {
    height: calc(100% - var(--pagination-height));

    /* SSR "fix" */
    transition: width 1s;

    display: flex;
    justify-content: center;
    align-items: center;
    
    border: 1px solid #9997;
  }
  
  .swiper-pagination {
    bottom: 0;
    
    display: flex;
    justify-content: center;
    align-items: center;
    height: var(--pagination-height);

    gap: 8px;
    @media (max-width: ${mobileBreakpoint}) {
      gap: 12px;
    }

    border: 1px solid #9997;
    background-color: white;
  }

`;
