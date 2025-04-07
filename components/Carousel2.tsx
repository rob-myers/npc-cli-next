"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import { css } from '@emotion/react';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

export default function Carousel2(props: Props) {
  return (
    <div css={carouselCss}>
      <CarouselProvider
        {...props}
        naturalSlideWidth={500}
        naturalSlideHeight={300}
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
        <ButtonBack>Back</ButtonBack>
        <ButtonNext>Next</ButtonNext>
      </CarouselProvider>
    </div>
  );
}

type Props = CarouselProviderProps & {
  // 🚧
  slides: {
    img: StaticImageData;
    label?: string;
  }[];
};

const carouselCss = css`
  .carousel__inner-slide {
    display: flex;
    align-items: center;
  }
  img {
    /* margin: 0; */
  }
`;
