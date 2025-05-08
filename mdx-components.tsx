import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    // strong: ({ className, ...props }) => (
    //   <strong className={className} {...props} style={{ color: 'yellow' }} />
    // ),
  }
}
