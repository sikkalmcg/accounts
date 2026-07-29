declare module '*.jpeg' {
  const source: import('next/image').StaticImageData;
  export default source;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

