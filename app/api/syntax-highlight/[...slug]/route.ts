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
 * curl --silent localhost:3000/api/syntax-highlight/js/foo | jq
 * curl --silent localhost:3000/api/syntax-highlight/js/const%20items%20%3D%20%5B1%2C%202%2C%20%22three%22%5D%3B | jq
 * ```
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const language = decodeURIComponent(slug[0]);
  const code = decodeURIComponent(slug[1]);

  // const markdownCode = '```js\nconst numbers = [1, 2, 3]\n```';
  const markdownCode = `\`\`\`${language}\n${code}\n\`\`\``;

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
