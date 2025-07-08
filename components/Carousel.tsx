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

  const initSlideId = React.useRef(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    startIndex: initSlideId.current,
    // slidesToScroll: props.slidesToScroll,
    // slidesToScroll: 'auto',
  }, []);

  const update = useUpdate();

  const state = useStateRef(() => ({
    currentSlide: initSlideId.current,
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

    // 🔔 fix hmr
    return () => void (initSlideId.current = state.currentSlide);
  }, [emblaApi, props.items]);

  return (
    <div
      className="carousel not-prose" // no tailwind typography
      css={carouselCss}
      style={{
        ...props.heights && {
          ['--slider-min-height' as any]: `${props.heights.min}px`,
          ['--slider-max-height' as any]: `${props.heights.max}px`,
          ['--slider-min-height-mobile' as any]: `${props.heights.minMobile ?? props.heights.min}px`,
          ['--slider-max-height-mobile' as any]: `${props.heights.maxMobile ?? props.heights.max}px`,
        },
        ...typeof props.slidesToScroll === 'number' && {
          ['--slider-slidesToScroll' as any]: props.slidesToScroll,
        },
      }}
    >

      <div
        className="embla__viewport"
        ref={emblaRef}
        style={{ filter: props.filter }}
      >
        <div className="embla__container">
          {props.items.map((item, index) => (
            <div className="embla__slide" key={index}>
              <div className="slide-label">
                <div>
                  {item.label}
                </div>
              </div>
              {'img' in item
                ? <Image
                    src={item.img.src}
                    width={item.img.width}
                    height={item.img.height}
                    alt={item.label}
                    style={{ objectPosition: item.objectPosition }}
                    priority={index === state.currentSlide}
                  />
                : item.component
              }
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

    </div>
  );
}

type EmblaOptionsType = NonNullable<Parameters<typeof useEmblaCarousel>[0]>;

interface Props extends EmblaOptionsType {
  items: ({
    label: string;
  } & (
    | {
        img: StaticImageData;
        /** CSS `object-position` applied to `<img>` */
        objectPosition?: string;
      }
    | {
        component: React.JSX.Element;
      }
    ))[];

  /** CSS `filter` e.g. `brightness(0.5)` */
  filter?: string;
  heights?: {
    min: number;
    max: number;
    minMobile?: number;
    maxMobile?: number;
  };
}

const carouselCss = css`
  --slider-max-height: unset;
  --slider-min-height: unset;
  --slider-max-height-mobile: unset;
  --slider-min-height-mobile: unset;
  --slide-spacing: 32px;
  --slider-dot-width: 0.75rem;
  --slider-dots-height: 64px;
  --slider-dot-gap: 16px;
  --slider-next-button-width: 32px;
  --slider-next-icon-width: 16px;
  --slider-border-radius: 16px;
  --slider-slidesToScroll: 1;
  
  user-select: none;
  margin: 48px 0;
  padding: 8px;

  @media (max-width: ${mobileBreakpoint}) {
    padding: 4px;
    margin: 32px 0;
    --slider-border-radius: 8px;
  }
  
  border: 1px solid #aaa;
  border-radius: var(--slider-border-radius);
  background-color: #444;
  
  @media (max-width: ${mobileBreakpoint}) {
    background-color: #ddd;
  }
  
  .embla__viewport {
    min-height: var(--slider-min-height);
    max-height: var(--slider-max-height);
    
    @media (max-width: ${mobileBreakpoint}) {
      min-height: var(--slider-min-height-mobile);
      max-height: var(--slider-max-height-mobile);
    }

    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: center;
    border-radius: var(--slider-border-radius);
  }

  .embla__container {
    display: flex;
    padding: 0;
  }

  .embla__slide {
    position: relative;
    flex: 0 0 calc(100% / var(--slider-slidesToScroll));
    
    margin-right: var(--slide-spacing);
    border-radius: var(--slider-border-radius);
    border: 1px dotted #fff4;
    background-color: #222;

    display: flex;
    flex-direction: column;

    /* slide content */
    >:nth-child(2) {
      margin: 0;
      border: 1px solid #555d;
      border-top: none;
      height: calc(100% - 64px - 64px);
      
      border-radius: 0 0 8px 8px;
      iframe {
        border-radius: 0 0 8px 8px;
      }

      object-fit: cover;
    }
  }

  .embla__buttons {
    position: absolute;
    z-index: 1;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 8px;
    margin-bottom: 16px;
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

    color: #000;
    background-color: #fff;
    border-radius: 50%;
    border: 1px solid #778;
  }
  .embla__button__svg {
    width: var(--slider-next-icon-width);
    height: var(--slider-next-icon-width);
    padding: 2px;
  }

  .slide-label {
    top: 0;
    width: 100%;
    min-height: 64px;
    height: 64px;
    overflow: hidden;

    display: flex;
    justify-content: center;
    align-items: center;

    text-align: center;
    
    @media (max-width: ${mobileBreakpoint}) {
      font-size: 0.9rem;
    }
    
    background-color: #222;

    > div {
      display: -webkit-box;
      /* 🔔 padding-top can cause errors i.e. can see part of next hidden line */
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; 
      overflow: hidden;
      user-select: text;
      
      /* padding: 0 32px; */
      color: white;
      letter-spacing: 1px;
    }

    a {
      color: #77d;
    }
  }

  .embla__dots {
    position: absolute;
    bottom: 0;
    height: var(--slider-dots-height);
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--slider-dot-gap);
    /* background-color: #3335; */
    border-radius: var(--slider-border-radius);
    padding: 0 16px;

    /* border: 1px solid red; */
    /* width: 100%;
    background-color: white; */
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
    
    /* background-color: #eee; */
    border-radius: 50%;
    border: 1px solid #999;
    background-color: black;
    
    &.embla__dot--selected {
      background-color: white;
      border: 2px solid #77f;
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
