// https://nextjs.org/learn-pages-router/basics/assets-metadata-css/global-styles

import "../src/components/globals.css";
// import "flexlayout-react/style/light.css";
// import "@xterm/xterm/css/xterm.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
