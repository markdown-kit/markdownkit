/**
 * TextProcessor - Unified text processing for Markdownkit
 * 
 * Combines the functionality of AutoFormatter and DraftTransformer:
 * - Structure detection (folders, lists, key-values)
 * - NLP processing (retext: pronouns, quotes, capitalization)
 * - Markdown cleanup (spacing, normalization)
 * 
 * @module text-processor
 */

import { retext } from 'retext';
import retextEnglish from 'retext-english';
import retextStringify from 'retext-stringify';
import retextSmartypants from 'retext-smartypants';
import retextSentenceSpacing from 'retext-sentence-spacing';
import { visit } from 'unist-util-visit';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

const defaultOptions = {
  // NLP options
  nlp: true,                    // Enable retext NLP processing
  fixPronouns: true,            // Fix "i" → "I"
  smartQuotes: true,            // Convert quotes to curly
  smartEllipsis: true,          // Convert "..." to "…"
  smartDashes: true,            // Convert "--" to em-dash
  capitalizeSentences: true,    // Capitalize first letter of sentences
  
  // Structure detection
  detectFolders: true,          // Convert "folder/" to "### Folder"
  detectLists: true,            // Convert indented lines to list items
  detectLabels: true,           // Convert "Key: value" to "**Key:** value"
  firstLineTitle: true,         // Convert first line to H1
  
  // Formatting options
  headerLevel: 3,               // Default header level for folders
  wrapWidth: 88,                // Line wrap width
  semanticBreaks: false,        // Break at sentence boundaries
  preserveCodeBlocks: true,     // Don't modify code blocks
  collapseBlankLines: true,     // Collapse multiple blank lines
  ensurePunctuation: true,      // Add period to lines without punctuation
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const SENTENCE_ENDINGS = /[.!?:;]$/;

const SKIP_PUNCTUATION_PATTERNS = [
  /^#+\s/,           // Headings
  /^[-*+]\s/,        // List items
  /^\d+\.\s/,        // Ordered lists
  /^>\s/,            // Blockquotes
  /^```/,            // Code fences
  /^\|/,             // Tables
  /^---$/,           // Horizontal rules
  /^\s*$/,           // Empty lines
  /\)$/,             // Lines ending with parenthesis
  /[`"']$/,          // Lines ending with quotes or backticks
];

// Structure detection rules (for autoformat)
const STRUCTURE_RULES = [
  {
    name: 'emoji-section-headers',
    pattern: /^([🚨⚠️💡🔧📋🎯🏗️]\s+)(.+)$/,
    transform: (match) => `## ${match[1]}${match[2]}`
  },
  {
    name: 'priority-labels',
    pattern: /^(IMMEDIATE|HIGH PRIORITY|MEDIUM PRIORITY|LOW PRIORITY)(\s*-\s*.+):$/,
    transform: (match) => `**${match[1]}**${match[2]}:`
  },
  {
    name: 'command-inline-code',
    pattern: /^(make\s+\w+|go\s+mod\s+\w+|npm\s+(?:install|run|test|build)|yarn\s+(?:install|add|test|build)|pnpm\s+(?:install|add|test|build)|git\s+(?:clone|pull|push|commit))$/,
    transform: (match) => `\`${match[0]}\``
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// RETEXT PLUGINS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom retext plugin to fix standalone "i" → "I"
 */
function retextFixPronouns() {
  return (tree) => {
    visit(tree, 'WordNode', (node) => {
      if (node.children && node.children.length === 1) {
        const textNode = node.children[0];
        if (textNode.type === 'TextNode' && textNode.value === 'i') {
          textNode.value = 'I';
        }
      }
    });
  };
}

/**
 * Custom retext plugin to capitalize first letter of sentences
 */
function retextCapitalizeSentences() {
  return (tree) => {
    visit(tree, 'SentenceNode', (sentence) => {
      // Find first word in sentence
      visit(sentence, 'WordNode', (word) => {
        if (word.children && word.children.length > 0) {
          const textNode = word.children[0];
          if (textNode.type === 'TextNode' && textNode.value) {
            const firstChar = textNode.value.charAt(0);
            if (firstChar && firstChar === firstChar.toLowerCase()) {
              textNode.value = firstChar.toUpperCase() + textNode.value.slice(1);
            }
          }
        }
        return false; // Only process first word
      });
    });
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT PROCESSOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class TextProcessor {
  constructor(options = {}) {
    this.options = { ...defaultOptions, ...options };
    this.retextProcessor = null;
  }

  /**
   * Initialize the retext processor with configured plugins
   */
  initRetextProcessor() {
    if (this.retextProcessor) return this.retextProcessor;

    let processor = retext().use(retextEnglish);

    // Add capitalization plugin
    if (this.options.capitalizeSentences) {
      processor = processor.use(retextCapitalizeSentences);
    }

    // Add pronoun fix (i → I)
    if (this.options.fixPronouns) {
      processor = processor.use(retextFixPronouns);
    }

    // Add sentence spacing normalization
    processor = processor.use(retextSentenceSpacing);

    // Add smartypants (quotes, dashes, ellipsis)
    if (this.options.smartQuotes || this.options.smartEllipsis || this.options.smartDashes) {
      processor = processor.use(retextSmartypants, {
        quotes: this.options.smartQuotes,
        dashes: this.options.smartDashes ? 'oldschool' : false,
        ellipses: this.options.smartEllipsis,
      });
    }

    // Stringify back to text
    processor = processor.use(retextStringify);

    this.retextProcessor = processor;
    return processor;
  }

  /**
   * Main async entry point - full processing with NLP
   * @param {string} text - Input text
   * @returns {Promise<string>} Processed text
   */
  async process(text) {
    // Step 1: Structure detection
    let result = this.detectStructure(text);

    // Step 2: NLP processing (if enabled)
    if (this.options.nlp) {
      result = await this.applyNLP(result);
    }

    // Step 3: Final cleanup
    result = this.cleanup(result);

    return result;
  }

  /**
   * Sync entry point - no NLP, basic processing only
   * @param {string} text - Input text
   * @returns {string} Processed text
   */
  processSync(text) {
    // Step 1: Structure detection
    let result = this.detectStructure(text);

    // Step 2: Basic cleanup (without NLP)
    result = this.basicCleanup(result);

    // Step 3: Final cleanup
    result = this.cleanup(result);

    return result;
  }

  /**
   * Detect and convert structure in raw text
   */
  detectStructure(text) {
    const lines = text.split('\n');
    const processed = [];
    let inCodeBlock = false;
    let isFirstNonEmptyLine = true;
    let prevLineWasBlank = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track code blocks
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        processed.push(line);
        prevLineWasBlank = false;
        continue;
      }

      // Preserve code blocks
      if (inCodeBlock && this.options.preserveCodeBlocks) {
        processed.push(line);
        continue;
      }

      // Handle blank lines
      if (!trimmed) {
        if (this.options.collapseBlankLines && prevLineWasBlank) {
          continue;
        }
        processed.push('');
        prevLineWasBlank = true;
        continue;
      }

      prevLineWasBlank = false;

      // RULE: Folder syntax ("name/" → "### Name")
      if (this.options.detectFolders && trimmed.endsWith('/') && !trimmed.includes(' ')) {
        const folderName = trimmed.slice(0, -1);
        const headerPrefix = '#'.repeat(this.options.headerLevel);
        const title = this.formatFolderName(folderName);
        processed.push(`${headerPrefix} ${title}`);
        processed.push('');
        isFirstNonEmptyLine = false;
        continue;
      }

      // RULE: First non-empty line becomes H1
      if (this.options.firstLineTitle && isFirstNonEmptyLine && !trimmed.startsWith('#')) {
        processed.push(`# ${trimmed}`);
        processed.push('');
        isFirstNonEmptyLine = false;
        continue;
      }
      isFirstNonEmptyLine = false;

      // RULE: Indented lines to list items
      if (this.options.detectLists) {
        const indentMatch = line.match(/^(\s{2,})(\S.*)$/);
        if (indentMatch && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
          const indentLevel = Math.floor(indentMatch[1].length / 2);
          const content = indentMatch[2];
          const prefix = '  '.repeat(Math.max(0, indentLevel - 1)) + '-';
          processed.push(`${prefix} ${content}`);
          continue;
        }
      }

      // RULE: Key-value pair detection
      if (this.options.detectLabels) {
        const keyValueMatch = trimmed.match(/^([A-Z][a-zA-Z\s]+):\s+(.+)$/);
        if (keyValueMatch && !trimmed.startsWith('**')) {
          processed.push(`**${keyValueMatch[1]}:** ${keyValueMatch[2]}`);
          continue;
        }
      }

      // Apply structure rules
      let transformed = trimmed;
      for (const rule of STRUCTURE_RULES) {
        const match = transformed.match(rule.pattern);
        if (match) {
          transformed = rule.transform(match);
          break;
        }
      }

      processed.push(transformed);
    }

    return processed.join('\n');
  }

  /**
   * Apply NLP processing via retext
   */
  async applyNLP(text) {
    const processor = this.initRetextProcessor();
    const lines = text.split('\n');
    const result = [];
    let inCodeBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track code blocks
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(line);
        continue;
      }

      // Skip code blocks, headings, and special lines
      if (inCodeBlock || 
          trimmed.startsWith('#') || 
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('>') ||
          trimmed.startsWith('|') ||
          trimmed.startsWith('**') ||
          trimmed === '') {
        result.push(line);
        continue;
      }

      // Process with retext
      try {
        const processed = await processor.process(trimmed);
        let nlpResult = String(processed).trim();

        // Ensure punctuation if needed
        if (this.options.ensurePunctuation) {
          nlpResult = this.ensurePunctuation(nlpResult);
        }

        result.push(nlpResult);
      } catch {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Basic cleanup without NLP (for sync mode)
   */
  basicCleanup(text) {
    const lines = text.split('\n');
    return lines.map(line => {
      const trimmed = line.trim();

      // Skip special lines
      if (!trimmed ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('```') ||
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('>') ||
          trimmed.startsWith('|') ||
          trimmed.startsWith('**')) {
        return line;
      }

      let result = trimmed;

      // Capitalize first letter
      if (this.options.capitalizeSentences && result) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
      }

      // Fix pronouns
      if (this.options.fixPronouns) {
        result = result.replace(/\bi\b/g, 'I');
      }

      // Ensure punctuation
      if (this.options.ensurePunctuation) {
        result = this.ensurePunctuation(result);
      }

      return result;
    }).join('\n');
  }

  /**
   * Final cleanup pass
   */
  cleanup(text) {
    let result = text;

    // Ensure blank line before headings
    result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // Ensure blank line after headings
    result = result.replace(/(#{1,6}\s.+)\n([^#\n])/g, '$1\n\n$2');

    // Collapse multiple blank lines
    result = result.replace(/\n{3,}/g, '\n\n');

    // Trim trailing whitespace on each line
    result = result.split('\n').map(l => l.trimEnd()).join('\n');

    // Ensure single trailing newline
    result = result.trim() + '\n';

    return result;
  }

  /**
   * Format folder name (kebab-case to Title Case)
   */
  formatFolderName(name) {
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Ensure line ends with punctuation
   */
  ensurePunctuation(str) {
    if (!str) return str;

    for (const pattern of SKIP_PUNCTUATION_PATTERNS) {
      if (pattern.test(str)) {
        return str;
      }
    }

    if (!SENTENCE_ENDINGS.test(str)) {
      return `${str}.`;
    }

    return str;
  }

  /**
   * Apply semantic line breaks
   */
  applySemanticBreaks(text) {
    if (!this.options.semanticBreaks) return text;

    const lines = text.split('\n');
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip short lines and special content
      if (trimmed.startsWith('#') ||
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('>') ||
          trimmed.startsWith('```') ||
          trimmed.length < this.options.wrapWidth) {
        result.push(line);
        continue;
      }

      // Split at sentence boundaries
      const sentences = line.split(/([.!?]+\s+)(?=[A-Z])/);
      const wrapped = [];
      let currentLine = '';

      for (const part of sentences) {
        if (currentLine.length + part.length > this.options.wrapWidth && currentLine.length > 0) {
          wrapped.push(currentLine.trim());
          currentLine = part;
        } else {
          currentLine += part;
        }
      }

      if (currentLine.trim()) {
        wrapped.push(currentLine.trim());
      }

      result.push(wrapped.join('\n'));
    }

    return result.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATIC METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Static async process method
   */
  static async process(text, options = {}) {
    const processor = new TextProcessor(options);
    return processor.process(text);
  }

  /**
   * Static sync process method
   */
  static processSync(text, options = {}) {
    const processor = new TextProcessor(options);
    return processor.processSync(text);
  }
}

// Export default options for external use
export { defaultOptions };
