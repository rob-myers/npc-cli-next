"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext, DotGroup } from 'pure-react-carousel';

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
              <div className="label">
                {label}
              </div>
            </Slide>
          )}
        </Slider>
        <ButtonBack>{'<'}</ButtonBack>
        <ButtonNext>{'>'}</ButtonNext>
        <DotGroup />
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
  
  --carousel-nav-button-height: 64px;
  margin: 48px 0;
  @media (max-width: ${mobileBreakpoint}) {
    /* --carousel-nav-button-height: 32px; */
    margin: 32px 0;
  }
  
  display: flex;
  justify-content: center;
  position: relative;
  user-select: none;
  
  background-color: #222;

  // 🚧
  .label {
    opacity: 0.5;
    transition: opacity 300ms;
  }
  &:hover .label, &:active .label, &:focus .label {
    opacity: 1;
  }
  
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
    justify-content: center;
    background-color: black;
  }
  .carousel__inner-slide .label {
    position: absolute;
    top: 0;
    padding: 8px 12px;
    line-height: 1;
    letter-spacing: 1px;

    font-size: 1.3rem;
    @media (max-width: ${mobileBreakpoint}) {
      font-size: 1rem;
    }
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-weight: 300;
    color: white;
    background-color: rgba(100, 100, 100, 0.2);
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

  .carousel__dot-group {
    --carousel-dot-group-height: 20px;
    --carousel-dot-height: 12px;
    
    position: absolute;
    bottom: 0;
    width: 100%;
    height: var(--carousel-nav-button-height);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;

    pointer-events: none;
    /* background-color: #ff000077; */
  }
  .carousel__dot {
    width: var(--carousel-dot-height);
    height: var(--carousel-dot-height);
    pointer-events: all;
    background-color: white;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    
    &.carousel__dot--selected span {
      display: block;
      width: calc(var(--carousel-dot-height) * 0.75);
      height: calc(var(--carousel-dot-height) * 0.75);
      background-color: #666;
      border-radius: 50%;
    }
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
