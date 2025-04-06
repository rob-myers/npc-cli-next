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

  width: 100%;
  /* height: 500px; // 🚧 */
  background-color: #ddd;
  
  li {
    margin: 0;
    padding: 0;
    /* margin-bottom: 24px; */
    display: flex;
    /* align-items: center; */
    justify-content: center;
  }
  img {
    object-fit: contain;

    filter: brightness(150%); // 🚧
    background-color: black;
  }

  ul.react-multi-carousel-track {
    padding-bottom: 24px;
  }

  ul.react-multi-carousel-dot-list  {
    padding: 24px 0;
  }
`;
