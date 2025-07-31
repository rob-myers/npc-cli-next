import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";

/**
 * `/api/syntax-highlight/{lang}/{code}`
 * 
 * ```sh
 * # examples
 * curl --silent -XPOST localhost:3000/api/syntax-highlight -d '{ "lang": "js", "code": "const items = [1, 2, \"three\"]" }' | jq
 * ```
 */
export async function POST(request: Request) {
  
  const payload = (await request.json()) as { lang: string, code: string };
  const { lang, code } = payload;
  
  // const markdownCode = '```js\nconst numbers = [1, 2, 3]\n```';
  const markdownCode = `\`\`\`${lang}\n${code}\n\`\`\``;

  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      theme: 'github-light-default',
    })
    .use(rehypeStringify)
    .process(markdownCode);

  return Response.json({
    html: file.toString(),
  });

}

// Required for build to work
export const dynamic = 'force-static';

export async function generateStaticParams(): Promise<Params[]> {
  // 🚧
  // const dirEntries = await fs.readdir("posts", { withFileTypes: true });
  // const blogNames = dirEntries
  //   .filter((x) => x.isDirectory() === false && x.name.endsWith(".mdx"))
  //   .map((x) => x.name.slice(0, -'.mdx'.length))
  // ;
  // return blogNames.map(blogName => ({ slug: [blogName] }));
  return [];
}

interface Params {
  lang: string;
  code: string;
}
