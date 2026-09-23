export default {
  // Configure remark-stringify output formatting
  settings: {
    bullet: '-', // Use - for unordered lists
    bulletOther: '*', // Use * for nested lists
    bulletOrdered: '.', // Use 1. 2. 3. for ordered lists
    emphasis: '*', // Use *emphasis* over _emphasis_
    strong: '*', // Use **strong** over __strong__
    fence: '`', // Use ``` for code fences
    fences: true, // Use fences for code blocks
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

    // Parse MDX content when present
    'remark-mdx',

    // Enable MDC syntax (Markdown Components for Nuxt Content)
    'remark-mdc',

    // MDD semantic plugins are no-ops outside .mdd files
    '@markdownkit/remark-mdd/plugins/document-structure',
    '@markdownkit/remark-mdd/plugins/text-formatting',

    // Apply consistent style presets
    'remark-preset-lint-consistent',
    'remark-preset-lint-recommended',

    // Lint rules
    ['remark-lint-heading-increment', true], // MD001
    ['remark-lint-no-duplicate-headings', true], // MD024
    ['remark-lint-no-emphasis-as-heading', true], // MD036
    ['remark-lint-emphasis-marker', '*'],
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
    'remark-stringify',
  ],
}
