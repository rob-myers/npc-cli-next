import Root from "@/components/Root";

export default async function BlogPage(props: {
  params: Promise<Slug>;
}) {

  const { slug } = await props.params;

  return (
    // <div>
    //   {JSON.stringify(slug)}
    // </div>
    <Root meta={{} as any}>
      Hello, World
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
