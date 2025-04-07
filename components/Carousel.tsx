"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext, ImageWithZoom } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

import { breakpoint } from './const';

export default function Carousel(props: Props) {

  const totalSlides = props.slides?.length ?? 0;

  return (
    <CarouselProvider
      css={carouselCss}
      {...props}

      naturalSlideWidth={props.naturalSlideWidth ?? props.aspectRatio ?? 16/9}
      naturalSlideHeight={props.naturalSlideHeight ?? 1}
      totalSlides={totalSlides}
      infinite
      dragEnabled
      touchEnabled={false}
      // lockOnWindowScroll
      // horizontalPixelThreshold={100}
    >
      <Slider>
        {props.slides.map(({ img, label }, index) =>
          <Slide
            index={index}
            {...props.mobileAspectRatio && { css: slideCss(props.mobileAspectRatio, totalSlides) }}
          >
            <Image
              src={img.src}
              width={img.width}
              height={img.height}
              alt={label ?? 'an image'} // 🚧
            />
          </Slide>
        )}
      </Slider>
      <ButtonBack>{'<'}</ButtonBack>
      <ButtonNext>{'>'}</ButtonNext>
    </CarouselProvider>
  );
}

type Props = CarouselProviderProps & {// 🚧
  /** Can use this instead of `naturalSlideWidth` and `naturalSlideHeight` */
  aspectRatio?: number;
  mobileAspectRatio?: number;
  slides: {
    img: StaticImageData;
    label?: string;
  }[];
};

const carouselCss = css`
  position: relative;
  background-color: #999;

  .carousel__inner-slide {
    display: flex;
    align-items: center;
    background-color: black;
  }
  .carousel__back-button, .carousel__next-button {
    position: absolute;
    bottom: 32px;
    
    line-height: 1.2;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    
    padding: 8px 24px;
    font-size: 2rem;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    
    @media (max-width: ${breakpoint}) {
      font-size: 1rem;
      font-weight: 700;
      padding: 4px 12px;
      background-color: rgba(100, 100, 100, 0.5);
      border: 1px solid #8888ff77;
    }
    
    border-radius: 8px;

    &:disabled {
      filter: brightness(50%);
    }
  }
  .carousel__back-button {
    left: 0;
    margin-left: 24px;
  }
  .carousel__next-button {
    right: 0;
    margin-right: 24px;
  }
`;

// tempStyle.paddingBottom = pct((naturalSlideHeight * 100) / (naturalSlideWidth * totalSlides));
function slideCss(mobileAspectRatio: number, totalSlides: number) {
  return css`
    @media (max-width: ${mobileBreakpoint}) {
      padding-bottom: ${(100 * (1 /mobileAspectRatio) * (1 / totalSlides)).toPrecision(6)}% !important;
    }
  `;
}

const mobileBreakpoint = '800px';
