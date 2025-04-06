"use client"

import ReactMultiCarousel, { ResponsiveType } from 'react-multi-carousel';
import { css } from '@emotion/react';

import "react-multi-carousel/lib/styles.css";

export default function Carousel({ children, ...rest }: Props) {
  return (
    <ReactMultiCarousel
      // additionalTransfrom={0}
      // arrows
      css={carouselCss}
      // centerMode
      // draggable
      // infinite
      // keyBoardControl
      // minimumTouchDrag={80}
      // renderDotsOutside

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
      swipeable

      {...rest}
    >
      {children}
    </ReactMultiCarousel>
  );
}

type Props = Omit<React.ComponentProps<typeof ReactMultiCarousel>, 'responsive'> & {
  responsive?: ResponsiveType;
  // 🚧
}

const carouselCss = css`

  /* height: 600px; */
  /* width: 100dvw; */
  width: 600px;
  width: 100%;

  li {
    display: flex;
    justify-content: center;
    /* align-items: center; */
  }
`;
