import React from 'react';
import Link from 'next/link';
import { promises as fs } from "fs";
import Card from "@/components/Card";
import SideNote from "@/components/SideNote";

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;
  const mdxFilename = `${slug[0]}.mdx` as const;
  const imported = await import(`@/posts/${mdxFilename}`);

  return <>

    {React.createElement(imported.default, {
      components: {
        Card,
        SideNote: (props: React.ComponentProps<typeof SideNote>) => (
          <SideNote bubbleClassName="not-prose" {...props} />
        ),
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          props.href ??= '';
          return (
            // <a
            //   {...props} // new-tab:href induces new tab
            //   {...props.href?.startsWith('new-tab:') && {
            //     href: props.href.slice('new-tab:'.length),
            //     target: "_blank",
            //   }}
            // >
            //   {props.children}
            // </a>
            <Link
              {...props}
              href={props.href.startsWith('new-tab:') ? props.href.slice('new-tab:'.length) : props.href}
              target={props.href.startsWith('new-tab:') ? "_blank" : props.target}
            >
              {props.children}
            </Link>
          );
        },
      },
    })}

    <script
      id="page-metadata-json"
      // stringify twice avoids "SyntaxError: Unexpected token ':' (at blog/:1:16614)"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON.stringify(
        imported.metadata ?? { key: 'fallback-metadata' }
      )) }}
    />

  </>;
}

export async function generateStaticParams(): Promise<Slug[]> {
  // const blogNames = await fetch(
  //   new URL(
  //     '/api/blog-names',
  //     `http://localhost:${process.env.DEV_ENV_PORT}`,
  //   )
  // ).then((res) => res.json()) as string[];
  // console.log(blogNames);

    const dirEntries = await fs.readdir("posts", { withFileTypes: true });
    const blogNames = dirEntries
      .filter((x) => x.isDirectory() === false && x.name.endsWith(".mdx"))
      .map((x) => x.name.slice(0, -'.mdx'.length))
    ;

  return blogNames.map(blogName => ({ slug: [blogName] }));
}

interface Slug {
  slug: string[];
}
