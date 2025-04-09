"use client"

import Image, { type StaticImageData } from 'next/image';
import { css } from '@emotion/react';
import useEmblaCarousel from 'embla-carousel-react';

export default function Carousel2(props: Props) {

  const [emblaRef, emblaApi] = useEmblaCarousel({
    // dragThreshold: ,
  }, []);

  return (
    <div css={carouselCss} className="embla" ref={emblaRef}>
      <div className="embla__container">
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

      <div className="embla__controls">
        {/* <div className="embla__buttons">
          <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
          <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
        </div>

        <div className="embla__dots">
          {scrollSnaps.map((_, index) => (
            <DotButton
              key={index}
              onClick={() => onDotButtonClick(index)}
              className={'embla__dot'.concat(
                index === selectedIndex ? ' embla__dot--selected' : ''
              )}
            />
          ))}
        </div> */}
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
  --slide-spacing: 1rem;

  overflow: hidden;
  /* height: 200px; */

  .embla__container {
    display: flex;
    gap: var(--slide-spacing);
  }
  .embla__slide {
    flex: 0 0 100%;
    min-width: 0;

    filter: brightness(1.5); // 🚧 temp

    img {
      height: 100%;
      object-fit: cover;
      object-position: 0% 0%;
    }
  }
`;