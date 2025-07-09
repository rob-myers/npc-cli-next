"use client";
import { Swiper, type SwiperClass, type SwiperProps, SwiperSlide } from 'swiper/react';

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
      loop={props.items.length > 2}
      centeredSlides
      modules={[Navigation, Pagination]}
      navigation={{ enabled: true }}
      onSwiper={api => state.swiper = api}
      pagination={{ clickable: true, type: 'fraction', dynamicBullets: false }}
      slidesPerView={props.slidesPerView ?? 1}
      spaceBetween={50}
      style={{
        ['--slider-height' as any]: `${props.height}px`,
        ['--slider-height-mobile' as any]: `${props.heightMobile ?? props.height}px`,
      }}
    >
      {props.items.map((child, index) =>
        <SwiperSlide key={index}>{child}</SwiperSlide>        
      )}
    </Swiper>
  );
}

interface Props extends Pick<SwiperProps, 'slidesPerView'> {
  height: number;
  heightMobile?: number;
  items: React.ReactElement[];
}

const carouselCss = css`
  --pagination-height: 48px;

  height: var(--slider-height);
  margin: 48px 0;
  
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
