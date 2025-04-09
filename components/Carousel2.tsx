"use client"

import { css } from '@emotion/react';
import useEmblaCarousel from 'embla-carousel-react';
import Image, { type StaticImageData } from 'next/image';

export default function Carousel2(props: Props) {

  const [emblaRef, emblaApi] = useEmblaCarousel({
    // dragThreshold: ,
  });

  return (
    <div css={carouselCss} className="embla" ref={emblaRef}>
      <div className="embla__container">
        {/* <div className="embla__slide">Slide 1</div>
        <div className="embla__slide">Slide 2</div>
        <div className="embla__slide">Slide 3</div> */}
        {props.items.map(({ img, label }) => (
          <div className="embla__slide">
            <Image
              src={img.src}
              width={img.width}
              height={img.height}
              alt={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type EmblaOptionsType = NonNullable<Parameters<typeof useEmblaCarousel>[0]>;

interface Props extends EmblaOptionsType {
  items: {
    img: StaticImageData;
    label: string;
  }[];
}

const carouselCss = css`
  overflow: hidden;
  
  width: 600px; // 🚧
  background-color: #000;

  .embla__container {
    display: flex;
  }
  .embla__slide {
    flex: 0 0 100%;
    min-width: 0;
    display: flex;
    align-items: center;
  }
`;