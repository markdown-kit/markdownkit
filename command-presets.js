/**
 * Shared command option presets.
 *
 * Keep command semantics aligned across CLI, LSP, and editor integrations.
 */

const DEFAULT_WRAP_WIDTH = 88

export function createAutoformatOptions(options = {}) {
  return {
    nlp: false,
    firstLineTitle: true,
    detectLabels: true,
    semanticBreaks: false,
    smartQuotes: false,
    smartEllipsis: false,
    wrapWidth: DEFAULT_WRAP_WIDTH,
    customRules: [],
    ...options,
  }
}

/**
 * Nuclear-mode step 1 ("safe polish"). The input is already Markdown, so no
 * structure detection (which would turn indented code into list items, trim
 * indentation, and bold `Key: value` lines) and no NLP; only typography.
 */
export function createNuclearPolishOptions(options = {}) {
  return {
    nlp: false,
    detectStructure: false,
    firstLineTitle: false,
    detectLabels: false,
    detectLists: false,
    detectFolders: false,
    reflowParagraphs: false,
    semanticBreaks: false,
    smartQuotes: true,
    smartEllipsis: true,
    smartDashes: false,
    wrapWidth: DEFAULT_WRAP_WIDTH,
    customRules: [],
    ...options,
  }
}

export function createDraftOptions(options = {}) {
  return {
    nlp: true,
    firstLineTitle: true,
    smartTitleDetection: true,
    normalizeHeadings: true,
    detectLabels: true,
    detectFolders: true,
    detectLists: true,
    reflowParagraphs: true,
    correctCommonTypos: true,
    headerLevel: 3,
    fixPronouns: true,
    ensurePunctuation: true,
    ...options,
  }
}
