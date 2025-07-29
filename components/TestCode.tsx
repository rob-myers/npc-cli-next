"use client";

import { useQuery } from "@tanstack/react-query";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";

export default function TestCode() {

  const { data } = useQuery({
    queryKey: ['test-code'],
    async queryFn() {

      const code = '```js\nconst numbers = [1, 2, 3]\n```';

      const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypePrettyCode, {
          theme: 'github-light-default',
        })
        .use(rehypeStringify)
        .process(code);

      return file.toString();
    },
  });

  return data ? (
    <section dangerouslySetInnerHTML={{ __html: data }} />
  ) : null;
}
