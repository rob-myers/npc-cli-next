import React from 'react';

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;
  const mdxFilename = `${slug[0]}.mdx` as const;
  // const content = await fs.readFile(path.join(repoRoot, 'posts', mdxFilename), 'utf-8');

  const imported = await import(`@/posts/${mdxFilename}`);

  console.log({ mdxFilename, imported });


  // const data = await compileMDX<FrontMatter>({
  //   source: content,
  //   options: {
  //     parseFrontmatter: true,
  //   },
  //   components: {
  //     Card,
  //     SideNote,
  //     // 🚧
  //   },
  // });

  return <>
    {/* <script
      id="frontmatter-json"
      // stringify twice avoids "SyntaxError: Unexpected token ':' (at blog/:1:16614)"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON.stringify(data.frontmatter)) }}
    />
    {data.content} */}
    {React.createElement(imported.default)}
  </>;
}

export async function generateStaticParams(): Promise<Slug[]> {
  // 🚧 generate from mdx metadata
  // const posts = await fetch('https://.../posts').then((res) => res.json())
  // return posts.map((post) => ({
  //   slug: post.slug,
  // }))
  return [{ slug: ['index'] }, { slug: ['strategy-1'] }];
}

interface Slug {
  slug: string[];
}

const repoRoot = process.cwd();
