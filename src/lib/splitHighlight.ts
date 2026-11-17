export interface HighlightedText {
  readonly lead: string;
  readonly highlight: string;
  readonly tail: string;
}

/**
 * Splits a headline around its highlighted phrase so the presentation layer
 * can render the highlight with a gradient while the copy stays in the service.
 */
export function splitHighlight(headline: string, highlight: string): HighlightedText {
  const index = headline.indexOf(highlight);
  if (index === -1 || highlight.length === 0) {
    return { lead: headline, highlight: "", tail: "" };
  }
  return {
    lead: headline.slice(0, index),
    highlight,
    tail: headline.slice(index + highlight.length),
  };
}
