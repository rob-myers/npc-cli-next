import React from 'react';
import Link from 'next/link';
import { promises as fs } from "fs";
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
        SideNote: (props: React.ComponentProps<typeof SideNote>) => (
          <SideNote bubbleClassName="not-prose" {...props} />
        ),
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          props.href ??= '';
          return (
            <Link
              {...props}
              href={props.href}
              target={props.title?.startsWith('@') ? props.target : '_blank'}
              title={props.title?.startsWith('@') ? props.title.slice(1) : props.title}
            >
              {props.children}
            </Link>
          );
        },
        pre: 'pre',
      },
    })}

    <script
      id="page-metadata-json"
      // stringify twice avoids "SyntaxError: Unexpected token ':' (at blog/:1:16614)"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(JSON.stringify(
          imported.metadata ?? { key: 'fallback-metadata' }
        ))
      }}
    />

  </>;
}

export async function generateStaticParams(): Promise<Slug[]> {
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
