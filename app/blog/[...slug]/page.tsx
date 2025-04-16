import React from 'react';
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
        // 🔔 convert href "/internal/..." to fragment identifier, enacted elsewhere
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          if (props.href?.startsWith('/internal/')) {
            return <a {...props} href={`#${props.href}`}>{props.children}</a>
          } else {
            return <a {...props}>{props.children}</a>;
          }
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
