"use client";
import { css } from '@emotion/react';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'

/** @param {Props} props */
export default function Video(props) {

  const meta = videoLookup[props.videoKey]

  if (meta === undefined) {
    return `props.videoKey not found: ${props.videoKey}`;
  }

  return (
    <figure
      css={rootCss}
      className="video"
      style={{ height: props.height }}
    >
      {typeof props.label !== undefined && <label>
        {props.label}
      </label>}
      <EmbeddedVideo id={meta.id} title={meta.title} /> 
    </figure>
  );
}

/**
 * @typedef Props
 * @property {VideoKey} videoKey
 * @property {React.ReactElement} [label]
 * @property {number | string} [height]
 */

const rootCss = css`
  position: relative;
  width: 100%;
  height: 100%;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  /* margin: 0; */
  border: 1px solid var(--page-border-color);

  label {
    position: absolute;
    z-index: 1;
    top: 16px;
    padding: 0 16px;
    background-color: #2228;
    color: white;
    border-radius: 8px;
  }

  article {
    width: 100%;
    height: 100%;
    background-size: contain;
    background-repeat: no-repeat;
    
    max-height: calc(100% - 128px);
    min-height: 100%;
    @media(max-width: 600px) {
      max-height: unset;
    }
  }
`;

const videoLookup = {
  mobileDemo: { id: 'WIIihWnOQ2E', title: 'mobile demo' },
  desktopDemo: { id: 'yDbGkW2umw4', title: 'desktop demo' },
  desktopDemo2: { id: 'w7P0FtfB4L4', title: 'desktop demo 2' },
};

/** @typedef {keyof typeof videoLookup} VideoKey */

/**
 * @param {EmbeddedVideoProps} props 
 */
function EmbeddedVideo(props) {
  return (
    <LiteYouTubeEmbed
      id={props.id}
      adNetwork={false}
      muted={props.muted}
      params='rel=0' // restrict related to current channel (?)
      playlist={props.playlist}
      playlistCoverId={props.playlistCoverId}
      title={props.title}
      poster="maxresdefault"
      webp
    />
  );
}

/**
 * @typedef EmbeddedVideoProps
 * @property {string} id
 * @property {string} title
 * @property {boolean} [muted]
 * @property {boolean} [playlist]
 * @property {string} [playlistCoverId]
 */
