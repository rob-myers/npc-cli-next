"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

export default function Carousel(props: Props) {
  return (
    <div css={carouselCss}>
      <CarouselProvider
        {...props}
        naturalSlideWidth={props.naturalSlideWidth ?? props.aspectRatio ?? 16/9}
        naturalSlideHeight={props.naturalSlideHeight ?? 1}
        totalSlides={2}
      >
        <Slider>
          {props.slides.map(({ img, label }, index) =>
            <Slide index={index} >
              <Image
                src={img.src}
                width={img.width}
                height={img.height}
                alt={label ?? 'an image'}
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
  // 🚧
  /** Can use this instead of `naturalSlideWidth` and `naturalSlideHeight` */
  aspectRatio?: number;
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
    top: 50%;
    padding: 8px 24px;

    line-height: 1.2;
    color: white;
    font-family: 'Courier New', Courier, monospace;
    font-size: 2rem;
    
    font-weight: 300;
    
    background-color: rgba(0, 0, 0, 0.5);
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
