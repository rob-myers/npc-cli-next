"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext, DotGroup, CarouselContext } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

import { mobileBreakpoint } from './const';

export default function Carousel(props: Props) {
  const totalSlides = props.slides?.length ?? 0;
  const aspectRatio = Array.isArray(props.aspectRatio) ? props.aspectRatio[1] : props.aspectRatio;
  const mobileAspectRatio = Array.isArray(props.aspectRatio) ? props.aspectRatio[0] : props.aspectRatio;

  return (
    <CarouselProvider
      {...props}
      css={carouselCss}
      {...props.maxHeight && { style: {[carouselMaxHeightCssVar as string]: `${props.maxHeight}px`} }}
      naturalSlideWidth={aspectRatio}
      naturalSlideHeight={1}
      totalSlides={totalSlides}
      infinite
      dragEnabled
      touchEnabled={false} // avoid scroll mobile interrupt
    >
      <CarouselLabel />
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
      <DotGroup />
    </CarouselProvider>
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
    --carousel-nav-button-height: 40px;
    margin: 32px 0;
  }
  
  display: flex;
  justify-content: center;
  position: relative;
  user-select: none;
  
  background-color: #222;

  > span.label {
    position: absolute;
    color: white;
    height: var(--carousel-nav-button-height);
    display: flex;
    align-items: center;
  }
  
  > div {
    width: 100%;
    max-height: var(--carousel-max-height);
    overflow: hidden;
    margin: var(--carousel-nav-button-height) 0;

    border: 1px solid rgba(100, 100, 100, 0.5);
    border-width: 1px 0;
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
    bottom: calc(var(--carousel-nav-button-height) * -1);
    width: 100%;
    height: var(--carousel-nav-button-height);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;

    pointer-events: none;
    background: none;
  }
  .carousel__dot {

    @media (max-width: ${mobileBreakpoint}) {
      --carousel-dot-height: 8px;
    }

    width: var(--carousel-dot-height);
    height: var(--carousel-dot-height);
    pointer-events: all;
    background-color: #888;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    
    &.carousel__dot--selected {
      background-color: white;
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

function CarouselLabel() {
  const carouselContext = React.useContext(CarouselContext);

  React.useEffect(() => {
    function onChange() {
      console.log('onChange', carouselContext.getStoreState().currentSlide);
    }
    carouselContext.subscribe(onChange);
    return () => carouselContext.unsubscribe(onChange);
  }, [carouselContext]);

  return (
    <span className="label">
      Foo bar
    </span>
  );
}
