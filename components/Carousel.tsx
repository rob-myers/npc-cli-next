"use client";
import { Swiper, type SwiperClass, SwiperSlide } from 'swiper/react';

import { Navigation, Pagination } from 'swiper/modules';
import { css } from '@emotion/react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import { mobileBreakpoint } from './const';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function Carousel(props: Props) {

  const state = useStateRef(() => ({
    swiper: {} as SwiperClass,
  }));

  return (
    <Swiper
      css={carouselCss}
      loop
      modules={[Navigation, Pagination]}
      navigation
      onSwiper={api => state.swiper = api}
      pagination={{ clickable: true }}
      slidesPerView={1}
      spaceBetween={50}
      style={{
        ...props.height && {
          ['--slider-height' as any]: `${props.height}px`,
          ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
        },
      }}
    >
      {props.items.map((child, index) =>
        <SwiperSlide key={index}>{child}</SwiperSlide>        
      )}
    </Swiper>
  );
}

interface Props {
  height?: number;
  heightMobile?: number;
  items: React.ReactElement[];
}

const carouselCss = css`
  height: var(--slider-height);
  margin: 48px 0;
  @media (max-width: ${mobileBreakpoint}) {
    margin: 32px 0;
  }
  
  @media (max-width: ${mobileBreakpoint}) {
    height: var(--slider-height-mobile);
  }

  .swiper-slide {
    display: flex;
    justify-content: center;
    align-items: center;
    
    border: 1px solid #999;

    /* 🚧 temp */
    figure {
      width: 100%;
      height: 100%;
    }
  }

`;
