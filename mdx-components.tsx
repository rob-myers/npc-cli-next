import type { MDXComponents } from 'mdx/types'
import Card from "@/components/Card";
import SideNote from "@/components/SideNote";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    Card,
    SideNote,
  }
}
