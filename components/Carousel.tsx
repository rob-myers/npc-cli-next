"use client"

import ReactMultiCarousel, { ResponsiveType } from 'react-multi-carousel';
import { css } from '@emotion/react';

import "react-multi-carousel/lib/styles.css";
import { afterBreakpoint, breakpoint } from './const';

export default function Carousel({ children, ...rest }: Props) {
  return (
    <div css={carouselCss}>
      <ReactMultiCarousel
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
      max-height: 600px;
    }
    @media (min-width: ${afterBreakpoint}) {
      max-height: 600px;
    }
  }

  background-color: #000;
  
  li {
    margin: 0;
    padding: 0;
    display: flex;
  }
  img {
    object-fit: contain;
    filter: brightness(150%); // 🚧
    background-color: black;
  }

  ul.react-multi-carousel-dot-list  {
    position: unset;
    gap: 8px;
    padding: 32px 0;
    filter: invert();
  }
`;
