# TODO

- ✅ migrate root component
  - ✅ Nav
  - ✅ Main
  - ✅ Viewer

- ❌ try add frontmatter to @next/mdx
  - https://vstollen.me/blog/advanced-mdx-layouts
  - decided to e.g.
  ```js
  import { default as Root } from '../src/components';

  export default Root({
    key: 'index',
    date: '2024-06-15',
    info: 'Home page',
    giscusTerm: '/home',
    label: 'home',
    path: '/',
    tags: ['cli', 'web dev', 'behaviour', 'video games'],
  });
  ```

- ✅ Can see World
- ✅ Can see Terminal
- ✅ `yarn ws-server`
- ✅ Provide created sprite-sheets
- ✅ `yarn dev` starts next and ws-server
- Get tty connected to World
- Can run assets script
- `yarn dev` runs and watches assets
