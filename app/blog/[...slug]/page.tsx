import React from 'react';

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;
  const mdxFilename = `${slug[0]}.mdx` as const;
  const imported = await import(`@/posts/${mdxFilename}`);

  return <>
    <script
      id="page-metadata-json"
      // stringify twice avoids "SyntaxError: Unexpected token ':' (at blog/:1:16614)"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON.stringify(
        imported.metadata ?? { key: 'fallback-metadata' }
      )) }}
    />
    {React.createElement(imported.default)}
  </>;
}

export async function generateStaticParams(): Promise<Slug[]> {
  // 🚧 generate automatically
  // const posts = await fetch('https://.../posts').then((res) => res.json())
  // return posts.map((post) => ({
  //   slug: post.slug,
  // }))
  return [{ slug: ['index'] }, { slug: ['strategy-1'] }];
}

interface Slug {
  slug: string[];
}

