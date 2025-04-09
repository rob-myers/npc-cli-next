"use client"

import Image, { type StaticImageData } from 'next/image';
import React from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';
import useEmblaCarousel from 'embla-carousel-react';

import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useUpdate from '@/npc-cli/hooks/use-update';

export default function Carousel2(props: Props) {

  const [emblaRef, emblaApi] = useEmblaCarousel({
    // dragThreshold: ,
    loop: true,
  }, []);

  const update = useUpdate();

  const state = useStateRef(() => ({
    selectedIndex: 0, // 🚧
    snapList: [] as number[],
    initDots() {
      state.snapList = emblaApi!.scrollSnapList();
    },
    onDotClick(index: number) {
      emblaApi?.scrollTo(index);
    },
    onNextClick() {
      emblaApi?.scrollNext();
    },
    onPrevClick() {
      emblaApi?.scrollPrev();
    },
    onSelect() {
      state.selectedIndex = emblaApi!.selectedScrollSnap();
      update();
    },
  }), { deps: [emblaApi] });

  React.useEffect(() => {
    if (!emblaApi) return

    state.initDots();
    state.onSelect();
    emblaApi
      .on('reInit', state.initDots)
      .on('reInit', state.onSelect)
      .on('select', state.onSelect)
    ;
  }, [emblaApi]);

  return (
    <div css={carouselCss} className="embla">
      
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {props.items.map(({ img, label }, index) => (
            <div className="embla__slide" key={index}>
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

      <div className="embla__controls">
        <div className="embla__buttons">
          <button
            className="embla__button embla__button--prev"
            type="button"
            onClick={state.onPrevClick}
          >
            {prevIcon}
          </button>

          <button
            className="embla__button embla__button--next"
            type="button"
            onClick={state.onNextClick}
          >
            {nextIcon}
          </button>
        </div>

        <div className="embla__dots">
          {state.snapList.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => state.onDotClick(index)}
              className={cx('embla__dot', {
                'embla__dot--selected': index === state.selectedIndex,
              })}
            />
          ))}
        </div>
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
  --text-high-contrast-rgb-value: 230, 230, 230;
  
  .embla__viewport {
    /* height: 200px; */
    overflow: hidden;
  }

  .embla__container {
    display: flex;
    /* gap: var(--slide-spacing); */
    padding: 0;
  }
  .embla__slide {
    flex: 0 0 100%;
    min-width: 0;
    margin-right: var(--slide-spacing);
    
    filter: brightness(1.5); // 🚧 temp

    img {
      margin: 0;
      height: 100%;
      object-fit: cover;
      object-position: 0% 0%;
    }
  }

  .embla__controls {
    display: grid;
    grid-template-columns: auto 1fr;
    justify-content: space-between;
    gap: 1.2rem;
    margin-top: 1.8rem;
  }
  .embla__buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
    align-items: center;
  }
  .embla__button {
    -webkit-tap-highlight-color: rgba(var(--text-high-contrast-rgb-value), 0.5);
    -webkit-appearance: none;
    appearance: none;
    background-color: transparent;
    touch-action: manipulation;
    display: inline-flex;
    text-decoration: none;
    cursor: pointer;
    border: 0;
    padding: 0;
    margin: 0;
    box-shadow: inset 0 0 0 0.2rem var(--detail-medium-contrast);
    width: 3.6rem;
    height: 3.6rem;
    z-index: 1;
    border-radius: 50%;
    color: var(--text-body);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .embla__button__svg {
    width: 20px;
    height: 20px;
  }

  .embla__dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }
  .embla__dot {
    cursor: pointer;
    border: 0;
    padding: 0;
    margin: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    
    background-color: black;
    border-radius: 50%;
  }
  .embla__dot:after {
    content: '';
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    background-color: black;
  }
  .embla__dot--selected:after {
    background-color: white;
  }


`;

const prevIcon = (
  <svg className="embla__button__svg" viewBox="0 0 532 532">
  <path
    fill="currentColor"
    d="M355.66 11.354c13.793-13.805 36.208-13.805 50.001 0 13.785 13.804 13.785 36.238 0 50.034L201.22 266l204.442 204.61c13.785 13.805 13.785 36.239 0 50.044-13.793 13.796-36.208 13.796-50.002 0a5994246.277 5994246.277 0 0 0-229.332-229.454 35.065 35.065 0 0 1-10.326-25.126c0-9.2 3.393-18.26 10.326-25.2C172.192 194.973 332.731 34.31 355.66 11.354Z"
  />
  </svg>
);

const nextIcon = (
  <svg className="embla__button__svg" viewBox="0 0 532 532">
    <path
      fill="currentColor"
      d="M176.34 520.646c-13.793 13.805-36.208 13.805-50.001 0-13.785-13.804-13.785-36.238 0-50.034L330.78 266 126.34 61.391c-13.785-13.805-13.785-36.239 0-50.044 13.793-13.796 36.208-13.796 50.002 0 22.928 22.947 206.395 206.507 229.332 229.454a35.065 35.065 0 0 1 10.326 25.126c0 9.2-3.393 18.26-10.326 25.2-45.865 45.901-206.404 206.564-229.332 229.52Z"
    />
  </svg>
);
