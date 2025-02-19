import { promises as fs } from 'fs'
import path from 'path'
import { compileMDX } from 'next-mdx-remote/rsc'

import Root, { Frontmatter } from "@/components/Root";
import Card from "@/components/Card";
import SideNote from "@/components/SideNote";

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;
  const content = await fs.readFile(path.join(repoRoot, 'src/posts', `${slug[0]}.mdx`), 'utf-8');

  const data = await compileMDX<Frontmatter>({
    source: content,
    options: {
      parseFrontmatter: true,
    },
    components: {
      Card,
      SideNote,
      // 🚧
    }
  });

  return (
    <Root meta={data.frontmatter}>
      {data.content}
    </Root>
  )
}

export async function generateStaticParams(): Promise<Slug[]> {
  // 🚧 generate from mdx metadata
  // const posts = await fetch('https://.../posts').then((res) => res.json())
  // return posts.map((post) => ({
  //   slug: post.slug,
  // }))
  return [{ slug: ['index'] }];
}

interface Slug {
  slug: string[];
}

const repoRoot = process.cwd();
