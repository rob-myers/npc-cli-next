import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";

// 🚧 dev/build task applies this endpoint to construct json imported by mdx

/**
 * `POST /api/syntax-highlight -d '{ "lang": "{lang}", "code": "{code}" }'`
 * 
 * ```sh
 * # e.g.
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
      theme: 'github-dark-default',
    })
    .use(rehypeStringify)
    .process(markdownCode);

  return Response.json({
    html: file.toString(),
  });

}

// Required for build to work
export const dynamic = 'force-static';
