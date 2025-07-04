import React from 'react';
import Link from 'next/link';
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
  // 🚧 generate automatically
  // const posts = await fetch('https://.../posts').then((res) => res.json())
  // return posts.map((post) => ({
  //   slug: post.slug,
  // }))
  return [
    { slug: ['index'] }, 
    { slug: ['strategy-1'] },
  ];
}

interface Slug {
  slug: string[];
}
