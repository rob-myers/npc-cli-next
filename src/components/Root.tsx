import Head from "next/head";

export default function Root({ meta, children }: Props) {
  return (
    <>
      <Head>
        <title>NPC CLI</title>
      </Head>
      {children}
    </>
  );
}

interface Props extends React.PropsWithChildren {
  meta: PageMeta;
}

interface PageMeta {
  key: string;
  date: string;
  info: string;
  giscusTerm: string;
  label: string;
  path: string;
  tags: string[];
}

export function WrapMdxWithRoot(meta: PageMeta) {
  return function RootWithMeta(props: React.PropsWithChildren) {
    return <Root meta={meta}>{props.children}</Root>;
  }
}
