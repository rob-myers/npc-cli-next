"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

import { mobileBreakpoint } from './const';

export default function Carousel(props: Props) {
  const totalSlides = props.slides?.length ?? 0;
  const aspectRatio = Array.isArray(props.aspectRatio) ? props.aspectRatio[1] : props.aspectRatio;
  const mobileAspectRatio = Array.isArray(props.aspectRatio) ? props.aspectRatio[0] : props.aspectRatio;

  return (
    <div
      css={carouselCss}
      className="carousel-container"
      {...props.maxHeight && { style: {[carouselMaxHeightCssVar as string]: `${props.maxHeight}px`} }}
    >
      <CarouselProvider
        {...props}
        naturalSlideWidth={aspectRatio}
        naturalSlideHeight={1}
        totalSlides={totalSlides}
        infinite
        dragEnabled
        touchEnabled={false} // avoid scroll mobile interrupt
      >
        <Slider>
          {props.slides.map(({ img, label }, index) =>
            <Slide
              index={index}
              css={mobileAspectRatioCss(mobileAspectRatio, totalSlides)} // 🚧 cache?
            >
              <Image
                src={img.src}
                width={img.width}
                height={img.height}
                alt={label}
              />
            </Slide>
          )}
        </Slider>
        <ButtonBack>{'<'}</ButtonBack>
        <ButtonNext>{'>'}</ButtonNext>
      </CarouselProvider>
    </div>
  );
}

type Props = CarouselProviderProps & {
  /**
   * - Use aspectRatio instead of `naturalSlideWidth` and `naturalSlideHeight`
   * - Can provide `[mobileAspect, nonMobileAspect]`
   */
  aspectRatio: number | [number, number];
  maxHeight?: number;
  slides: {
    img: StaticImageData;
    label: string;
  }[];
};

const carouselMaxHeightCssVar = '--carousel-max-height';

const carouselCss = css`
  ${carouselMaxHeightCssVar}: 500px;

  margin: 48px 0;
  --carousel-nav-button-height: 48px;
  @media (max-width: ${mobileBreakpoint}) {
    margin: 32px 0;
    --carousel-nav-button-height: 32px;
  }
  
  display: flex;
  justify-content: center;
  position: relative;
  user-select: none;
  
  background-color: #222;
  
  > div {
    width: 100%;
    max-height: var(--carousel-max-height);
    overflow: hidden;
    margin: var(--carousel-nav-button-height) 0;

    border: 1px solid rgba(100, 100, 100, 1);
    border-width: 2px 0;
    background-color: #444;
  }

  .carousel__slider {
    // 🚧 better images
    filter: brightness(150%);
  }
  .carousel__inner-slide {
    display: flex;
    align-items: center;
    background-color: black;
  }
  .carousel__back-button, .carousel__next-button {
    position: absolute;
    bottom: 0;
    height: var(--carousel-nav-button-height);
    
    line-height: 1.2;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    font-size: 1rem;
    
    padding: 8px 24px;
    background-color: rgba(0, 0, 0, 1);
    color: white;
    
    &:disabled {
      filter: brightness(50%);
    }
  }
  .carousel__back-button {
    left: 0;
  }
  .carousel__next-button {
    right: 0;
  }
`;

function mobileAspectRatioCss(mobileAspectRatio: number, totalSlides: number) {
  return css`
    @media (max-width: ${mobileBreakpoint}) {
      // tempStyle.paddingBottom = pct((naturalSlideHeight * 100) / (naturalSlideWidth * totalSlides));
      padding-bottom: ${(100 * (1 /mobileAspectRatio) * (1 / totalSlides)).toPrecision(6)}% !important;
    }
  `;
}
