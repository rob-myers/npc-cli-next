import React from 'react';
import Link from 'next/link';
import { type Dirent, promises as fs } from "fs";
import SideNote from "@/components/SideNote";

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;
  const imported = await import(`@/posts/${slug.join('/')}.mdx`);

  return <>

    {React.createElement(imported.default, {
      components: {
        SideNote: (props: React.ComponentProps<typeof SideNote>) => (
          <SideNote bubbleClassName="not-prose" {...props} />
        ),
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          props.href ??= '';
          if (props.href.startsWith('#')) {
            return (// 🔔 <Link> reloaded anchor
              <a {...props} href={props.href}>
                {props.children}
              </a>
            );
          } else {
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
          }
        },
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
  const rootEntries = await fs.readdir("posts", { withFileTypes: true });
  const mainEntries = await fs.readdir("posts/main", { withFileTypes: true });
  const devEntries = await fs.readdir("posts/dev", { withFileTypes: true });
  return [
    ...extractMdxFilenames(rootEntries).map(blogName => ({ slug: [blogName] })),
    ...extractMdxFilenames(mainEntries).map(blogName => ({ slug: ['main', blogName] })),
    ...extractMdxFilenames(devEntries).map(blogName => ({ slug: ['dev', blogName] })),
  ];
}

interface Slug {
  slug: string[];
}

function extractMdxFilenames(entries: Dirent[]) {
  return entries
    .filter((x) => x.isDirectory() === false && x.name.endsWith(".mdx"))
    .map((x) => x.name.slice(0, -'.mdx'.length))
  ;
}
