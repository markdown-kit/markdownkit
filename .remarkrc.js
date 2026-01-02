/**
 * Opinionated Remark configuration for markdown processing
 * Supports .md, .mdx, and .mdc files with consistent formatting
 * Optionally supports .mdd files if mdd package is installed
 */

// Try to load MDD plugins if available
let mddPlugins = [];
try {
  const mddDocStructure = await import('@markdownkit/mdd/plugins/remark-mdd-document-structure.js');
  const mddTextFormatting = await import('@markdownkit/mdd/plugins/remark-mdd-text-formatting.js');
  const mddMdxConditional = await import('@markdownkit/mdd/plugins/remark-mdx-conditional.js');

  mddPlugins = [
    mddMdxConditional.default,
    mddDocStructure.default,
    mddTextFormatting.default
  ];
  console.log('✓ MDD support enabled');
} catch (e) {
  // MDD package not installed - only support .md, .mdx, and .mdc
  mddPlugins = ['remark-mdx'];
  console.log('ℹ MDD support not available (install mdd package for .mdd file support)');
}

export default {
  // Configure remark-stringify output formatting
  settings: {
    bullet: '-', // Use - for unordered lists
    bulletOther: '*', // Use * for nested lists
    bulletOrdered: '.', // Use 1. 2. 3. for ordered lists
    emphasis: '_', // Use _emphasis_ over *emphasis*
    strong: '*', // Use **strong** over __strong__
    fence: '`', // Use ``` for code fences
    fences: true, // Use fences for code blocks (disabled for MDX in cli.js)
    incrementListMarker: true, // Increment ordered list markers
    listItemIndent: 'one', // Use one space for list indentation
    quote: '"', // Use double quotes in titles
    rule: '-', // Use --- for horizontal rules
    ruleRepetition: 3, // Use exactly 3 characters for rules
    ruleSpaces: false, // No spaces in horizontal rules
    setext: false, // Use # instead of === underlines
    tightDefinitions: true, // No blank lines between definitions
    resourceLink: false, // Don't escape link URLs unnecessarily
    break: 'spaces', // Use two spaces for line breaks instead of backslashes
  },

  plugins: [
    // Enable support for frontmatter (---, +++)
    'remark-frontmatter',

    // Enable GitHub Flavored Markdown (tables, strikethrough, etc.)
    'remark-gfm',

    // Enable MDC syntax (Markdown Components for Nuxt Content)
    'remark-mdc',

    // MDX/MDD plugins (loaded dynamically above)
    ...mddPlugins,

    // Apply consistent style presets
    'remark-preset-lint-consistent',
    'remark-preset-lint-recommended',
    'remark-preset-lint-markdown-style-guide',

    // Lint rules
    ['remark-lint-heading-increment', true], // MD001
    ['remark-lint-no-duplicate-headings', true], // MD024
    ['remark-lint-no-emphasis-as-heading', true], // MD036
    ['remark-lint-emphasis-marker', '_'],
    ['remark-lint-strong-marker', '*'],
    ['remark-lint-heading-style', 'atx'],
    ['remark-lint-list-item-indent', 'one'],
    ['remark-lint-ordered-list-marker-style', '.'],
    ['remark-lint-ordered-list-marker-value', 'ordered'],
    ['remark-lint-unordered-list-marker-style', '-'],
    ['remark-lint-table-cell-padding', 'padded'],
    ['remark-lint-table-pipe-alignment', true],
    ['remark-lint-link-title-style', '"'],
    ['remark-lint-no-trailing-spaces', true],
    ['remark-lint-final-newline', true],
    ['remark-lint-hard-break-spaces', true],
    ['remark-lint-no-empty-sections', true],

    // Must be last - handles the output formatting
    'remark-stringify'
  ]
}