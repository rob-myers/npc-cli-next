"use client"

import Image, { type StaticImageData } from 'next/image';
import React from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';
import useEmblaCarousel from 'embla-carousel-react';

import { mobileBreakpoint } from './const';
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useUpdate from '@/npc-cli/hooks/use-update';

export default function Carousel(props: Props) {

  // 🚧 for better hmr move "innards" into own component
  const [emblaRef, emblaApi] = useEmblaCarousel({
    // dragThreshold: ,
    loop: true,
  }, []);

  const update = useUpdate();

  const state = useStateRef(() => ({
    currentSlide: 0,
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
      state.currentSlide = emblaApi!.selectedScrollSnap();
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
  }, [emblaApi, props.items]);

  return (
    <div
      css={carouselCss}
      {...props.maxHeight && { style: { ['--slider-max-height' as any]: `${props.maxHeight}px` } }}
    >
      
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
              <div className="slide-label">
                <div>
                {label}
                </div>
              </div>
            </div>
          ))}
        </div>

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
      </div>

      <div className="embla__dots">
        {state.snapList.map((_, index) => (
          <button
            type="button"
            key={index}
            onClick={() => state.onDotClick(index)}
            className={cx('embla__dot', {
              'embla__dot--selected': index === state.currentSlide,
            })}
          />
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
  maxHeight?: number;
}

// 🚧 remove hard-coded lengths
// 🚧 responsive button/label distance from bottom
const carouselCss = css`
  --slider-max-height: unset;
  --slide-spacing: 1rem;
  --slider-dot-width: 0.75rem;
  --slider-dots-height: 48px;
  --slider-dot-gap: 16px;
  --slider-next-button-width: 32px;
  --slider-next-icon-width: 16px;
  
  user-select: none;
  margin: 40px 0 20px 0;
  @media (max-width: ${mobileBreakpoint}) {
    margin: 24px 0 0 0;
  }
  
  .embla__viewport {
    max-height: var(--slider-max-height);
    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: center;
  }

  .embla__container {
    display: flex;
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
      border-radius: 16px;
    }
  }

  .embla__buttons {
    position: absolute;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    width: calc(100% - 24px * 2);
    margin: 32px 0;
    pointer-events: none;
  }
  .embla__button {
    width: var(--slider-next-button-width);
    height: var(--slider-next-button-width);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    padding: 0;
    margin: 0;
    
    -webkit-tap-highlight-color: #0000ff22;
    -webkit-appearance: none;
    appearance: none;
    touch-action: manipulation;
    text-decoration: none;
    cursor: pointer;

    pointer-events: all;

    color: #fff;
    background-color: #222;
    border-radius: 50%;
    border: 1px solid #778;
  }
  .embla__button__svg {
    width: var(--slider-next-icon-width);
    height: var(--slider-next-icon-width);
  }
  .slide-label {
    position: absolute;
    bottom: 0;
    width: 100%;
    height: calc(36px + 64px);
    max-height: calc(36px + 64px);
    overflow: hidden;
    // 🚧
    padding: 0 calc(64px + 8px);
    color: #99a;
    background-color: #00000066;
    border-radius: 0 0 16px 16px;
    flex: 1;
    text-align: center;
    
    display: flex;
    justify-content: center;
    align-items: center;
    
    > div {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; 
      overflow: hidden;
      user-select: text;
    }
  }

  .embla__dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--slider-dot-gap);
    height: var(--slider-dots-height);
  }
  .embla__dot {
    cursor: pointer;
    border: 0;
    padding: 0;
    margin: 0;
    width: var(--slider-dot-width);
    height: var(--slider-dot-width);
    display: flex;
    align-items: center;
    justify-content: center;
    
    background-color: #eee;
    border-radius: 50%;
    border: 1px solid #999;
    
    &.embla__dot--selected {
      background-color: white;
      border: 2px solid #444;
    }
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
