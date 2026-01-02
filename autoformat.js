/**
 * AutoFormatter - Backward Compatibility Wrapper
 * 
 * This module wraps TextProcessor for backward compatibility.
 * New code should use TextProcessor directly:
 * 
 *   import { TextProcessor } from './text-processor.js';
 * 
 * @module autoformat
 */

import { TextProcessor } from './text-processor.js';

/**
 * AutoFormatter class - wraps TextProcessor
 */
export class AutoFormatter {
  constructor(options = {}) {
    // Map old option names to new ones
    this.options = {
      nlp: false, // AutoFormatter didn't have NLP by default
      detectFolders: options.roughDraft ?? false,
      detectLists: options.roughDraft ?? false,
      firstLineTitle: options.aggressive ?? true,
      detectLabels: options.aggressive ?? true,
      semanticBreaks: options.semanticBreaks ?? false,
      smartQuotes: options.smartQuotes ?? false,
      smartEllipsis: options.ellipsis ?? false,
      wrapWidth: options.wrapWidth ?? 88,
      preserveCodeBlocks: options.preserveCodeBlocks ?? true,
      ...options,
    };
    this.processor = new TextProcessor(this.options);
  }

  /**
   * Format text (sync)
   * @param {string} text - Input text
   * @returns {string} Formatted text
   */
  format(text) {
    return this.processor.processSync(text);
  }

  /**
   * Format text (async, with NLP)
   * @param {string} text - Input text
   * @returns {Promise<string>} Formatted text
   */
  async formatAsync(text) {
    this.processor.options.nlp = true;
    return this.processor.process(text);
  }
}

export default AutoFormatter;
