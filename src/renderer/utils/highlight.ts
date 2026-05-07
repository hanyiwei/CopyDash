import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Structured markup: HTML/SVG/XML
const MARKUP_RE = /^\s*<(html|svg|head|body|div|!DOCTYPE|xml|\?xml)\b/i;

// Markdown: headings, bold, italic, links, code fences, lists
const MD_RE = /(^|\n)(#{1,6}\s|\*\*|__|[*_]\S.*\S[*_]|\[.+\]\(.+\)|```|[-*+]\s|\d+\.\s|\|[^|\n]+\|)/m;

export function maybeHighlight(code: string): { html: string; highlighted: boolean } {
  if (MARKUP_RE.test(code) || MD_RE.test(code)) {
    return { html: hljs.highlightAuto(code).value, highlighted: true };
  }
  return { html: code, highlighted: false };
}
