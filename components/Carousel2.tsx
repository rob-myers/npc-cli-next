"use client"

import { type StaticImageData } from 'next/image';
import Image from 'next/image';
import React from 'react';
import { CarouselProvider, CarouselProviderProps, Slider, Slide, ButtonBack, ButtonNext } from 'pure-react-carousel';

import 'pure-react-carousel/dist/react-carousel.es.css';

export default function Carousel2(props: Props) {
  return (
    <CarouselProvider
      {...props}
      naturalSlideWidth={100}
      naturalSlideHeight={125}
      totalSlides={2}
    >
      <Slider>
        {props.slides.map(({ img, label }, index) =>
          <Slide index={index}>
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
  );
}

type Props = CarouselProviderProps & {
  // 🚧
  slides: {
    img: StaticImageData;
    label?: string;
  }[];
};
