export type WordElement = {
  type?: string;
  children?: WordElement[];
  styleId?: string | null;
  styleName?: string | null;
  alignment?: string | null;
  indent?: {
    start?: string | null;
    end?: string | null;
    firstLine?: string | null;
    hanging?: string | null;
  };
  numbering?: unknown;
  font?: string | null;
  fontSize?: number | null;
  [key: string]: unknown;
};

export type WordHtmlOptions = {
  styleMap: string[];
  ignoreEmptyParagraphs: false;
  transformDocument: (element: WordElement) => WordElement;
  generatedStyles: Map<string, string>;
};
