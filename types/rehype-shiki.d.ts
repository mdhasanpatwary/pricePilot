declare module 'rehype-shiki' {
    import type { Plugin } from 'unified';

    interface RehypeShikiOptions {
        highlighter?: any;
        theme?: string;
        themes?: Record<string, string>;
    }

    const rehypeShiki: Plugin<[RehypeShikiOptions?]>;
    export default rehypeShiki;
}
