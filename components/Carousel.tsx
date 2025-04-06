"use client"

import React from 'react';
import ReactMultiCarousel, { ResponsiveType } from 'react-multi-carousel';
import { css } from '@emotion/react';

import "react-multi-carousel/lib/styles.css";
import { afterBreakpoint, breakpoint } from './const';
import useStateRef from '@/npc-cli/hooks/use-state-ref';
import useMeasure from 'react-use-measure';

export default function Carousel({ children, ...rest }: Props) {

  const state = useStateRef(() => ({
    carousel: {} as ReactMultiCarousel,
  }));

  const [measureRef, bounds] = useMeasure(({ debounce: 0 }));

  React.useEffect(() => {
    state.carousel?.forceUpdate();
  }, [bounds]);

  return (
    <div
      css={carouselCss}
      ref={measureRef}
    >
      <ReactMultiCarousel
        ref={state.ref('carousel')}
        infinite
        renderDotsOutside

        responsive={{// 🚧
          desktop: {
            breakpoint: {
              max: 3000,
              min: 1024
            },
            items: 1
          },
          mobile: {
            breakpoint: {
              max: 464,
              min: 0
            },
            items: 1
          },
          tablet: {
            breakpoint: {
              max: 1024,
              min: 464
            },
            items: 1
          }
        }}

        showDots
        slidesToSlide={1}
        draggable={false}
        swipeable={false}

        {...rest}
      >
        {children}
      </ReactMultiCarousel>
    </div>
  );
}

type Props = Omit<React.ComponentProps<typeof ReactMultiCarousel>, 'responsive'> & {
  responsive?: ResponsiveType;
  // 🚧
}

const carouselCss = css`
  width: 100%;

  > div {
    @media (max-width: ${breakpoint}) {
      max-height: 400px;
      height: 400px;
    }
    @media (min-width: ${afterBreakpoint}) {
      max-height: 500px;
      height: 500px;
    }
  }

  background-color: #000;
  
  ul {
    height: 100%;
  }
  li {
    margin: 0;
    padding: 0;
    display: flex;
  }
  img {
    object-fit: cover;
    object-position: 0% 0%;
    filter: brightness(150%); // 🚧
    margin: 0;
  }

  ul.react-multi-carousel-dot-list  {
    position: unset;
    gap: 8px;
    padding: 32px 0;
    filter: invert();
  }
`;
