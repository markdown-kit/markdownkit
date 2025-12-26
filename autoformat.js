/**
 * Auto-formatting engine for converting plain text to structured markdown
 * Supports plugin system for custom formatting rules
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * Default formatting rules
 * These can be overridden or extended via plugins
 */
const defaultRules = [
  {
    name: 'numbered-sections',
    description: 'Convert numbered items to H3',
    pattern: /^(\d+)\.\s+(.+)$/,
    transform: (match) => `### ${match[1]}. ${match[2]}`
  },
  {
    name: 'emoji-section-headers',
    description: 'Convert lines with emoji + text to H2',
    pattern: /^([🚨⚠️💡🔧📋🎯🏗️]\s+)(.+)$/,
    transform: (match) => `## ${match[1]}${match[2]}`
  },
  {
    name: 'colon-labels',
    description: 'Bold lines ending with colon (Issue:, Fix:, etc.)',
    pattern: /^(Issue|Impact|Fix|Gap|Recommendation|Enhancement|Security Risk):\s*(.*)$/,
    transform: (match) => `**${match[1]}:** ${match[2]}`
  },
  {
    name: 'file-paths',
    description: 'Convert file paths to inline code',
    pattern: /\b([a-z_][a-z0-9_-]*\/[a-z_][a-z0-9_-]*(?:\/[a-z0-9_.-]+)*(?:\.[a-z]+)?)\b/gi,
    skipInLabels: true,
    transform: (match) => `\`${match[0]}\``
  },
  {
    name: 'first-line-title',
    description: 'Convert first non-empty line to H1',
    isFirstLine: true,
    pattern: /^([^#].+)$/,
    transform: (match) => `# ${match[1]}`
  },
  {
    name: 'multiple-blank-lines',
    description: 'Collapse multiple blank lines to single',
    pattern: /\n{3,}/g,
    transform: () => '\n\n'
  },
  {
    name: 'ordered-lists',
    description: 'Ensure proper ordered list formatting',
    pattern: /^(\d+)\.\s+(.+)$/,
    skipIfH3: true, // Don't apply if already converted to H3
    transform: (match) => `${match[1]}. ${match[2]}`
  },
  {
    name: 'unordered-lists',
    description: 'Ensure proper unordered list formatting',
    pattern: /^[-*]\s+(.+)$/,
    transform: (match) => `- ${match[1]}`
  },
  {
    name: 'priority-labels',
    description: 'Bold priority level labels',
    pattern: /^(IMMEDIATE|HIGH PRIORITY|MEDIUM PRIORITY|LOW PRIORITY)(\s*-\s*.+):$/,
    transform: (match) => `**${match[1]}**${match[2]}:`
  },
  {
    name: 'command-inline-code',
    description: 'Convert command names to inline code',
    pattern: /^(make\s+\w+|go\s+mod\s+\w+|npm\s+(?:install|run|test|build)|yarn\s+(?:install|add|test|build)|pnpm\s+(?:install|add|test|build)|git\s+(?:clone|pull|push|commit))$/,
    transform: (match) => `\`${match[0]}\``
  },
  {
    name: 'list-items-after-colon',
    description: 'Convert lines after Recommendation:/Add/etc to list items',
    pattern: /^([A-Z][a-z][\w\s]+(?:\([^)]+\))?)$/,
    contextCheck: true,
    transform: (match) => `- ${match[1]}`
  }
];

/**
 * Plugin system - allows users to add custom formatting rules
 */
class AutoFormatter {
  constructor(options = {}) {
    this.rules = [...defaultRules];
    this.plugins = [];
    this.options = {
      aggressive: true,
      preserveCodeBlocks: true,
      semanticBreaks: false,
      smartQuotes: false,
      ellipsis: false,
      wrapWidth: 88,
      ...options
    };
  }

  /**
   * Register a plugin with custom rules
   * @param {Object} plugin - Plugin object with rules array
   */
  registerPlugin(plugin) {
    if (!plugin.rules || !Array.isArray(plugin.rules)) {
      throw new Error('Plugin must have a rules array');
    }
    
    this.plugins.push(plugin);
    this.rules.push(...plugin.rules);
  }

  /**
   * Load plugins from a directory
   * @param {string} pluginDir - Directory containing plugin files
   */
  async loadPlugins(pluginDir) {
    try {
      const pluginFiles = await glob('*.js', { cwd: pluginDir });
      
      for (const file of pluginFiles) {
        const pluginPath = path.join(pluginDir, file);
        const plugin = await import(pluginPath);
        this.registerPlugin(plugin.default || plugin);
      }
    } catch (error) {
      // Plugin directory doesn't exist or no plugins found
      // This is fine, just use default rules
    }
  }

  /**
   * Apply semantic line breaks - break at sentence boundaries
   * @param {string} text - Input text
   * @returns {string} Text with semantic breaks
   */
  applySemanticBreaks(text) {
    if (!this.options.semanticBreaks) return text;
    
    const lines = text.split('\n');
    const result = [];
    
    for (const line of lines) {
      // Skip code blocks, headings, lists, and short lines
      if (line.trim().startsWith('```') || 
          line.trim().startsWith('#') || 
          line.trim().startsWith('-') ||
          line.trim().startsWith('*') ||
          line.trim().startsWith('>') ||
          line.length < this.options.wrapWidth) {
        result.push(line);
        continue;
      }
      
      // Split at sentence boundaries: . ! ? followed by space and capital letter
      const sentences = line.split(/([.!?]+\s+)(?=[A-Z])/);
      const wrapped = [];
      let currentLine = '';
      
      for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
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

  /**
   * Apply smart typography - convert quotes and ellipsis
   * @param {string} text - Input text
   * @returns {string} Text with smart typography
   */
  applySmartTypography(text) {
    let result = text;
    
    // Apply smart quotes
    if (this.options.smartQuotes) {
      const lines = result.split('\n');
      const processed = [];
      let inCodeBlock = false;
      
      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          processed.push(line);
          continue;
        }
        
        if (inCodeBlock || line.trim().startsWith('`')) {
          processed.push(line);
          continue;
        }
        
        let newLine = line;
        // Convert double quotes
        newLine = newLine.replace(/"([^"]+)"/g, '\u201C$1\u201D');
        // Convert single quotes (apostrophes and quotes)
        newLine = newLine.replace(/\b'([^']+)'\b/g, '\u2018$1\u2019');
        newLine = newLine.replace(/(\w)'(\w)/g, '$1\u2019$2'); // Contractions
        
        processed.push(newLine);
      }
      
      result = processed.join('\n');
    }
    
    // Apply ellipsis conversion
    if (this.options.ellipsis) {
      const lines = result.split('\n');
      const processed = [];
      let inCodeBlock = false;
      
      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          processed.push(line);
          continue;
        }
        
        if (inCodeBlock) {
          processed.push(line);
          continue;
        }
        
        // Convert ... to ellipsis when adjacent to words/punctuation
        let newLine = line.replace(/(\w)\.\.\.(\w)/g, '$1…$2');
        newLine = newLine.replace(/(\w)\.\.\./g, '$1…');
        newLine = newLine.replace(/\.\.\.(\w)/g, '…$1');
        
        processed.push(newLine);
      }
      
      result = processed.join('\n');
    }
    
    return result;
  }

  /**
   * Format plain text to structured markdown
   * @param {string} text - Input text
   * @returns {string} Formatted markdown
   */
  format(text) {
    let lines = text.split('\n');
    let formatted = [];
    let isFirstNonEmptyLine = true;
    let inCodeBlock = false;

    // First pass: Apply line-by-line rules
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let matched = false;

      // Skip if in code block
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        formatted.push(line);
        continue;
      }

      if (inCodeBlock) {
        formatted.push(line);
        continue;
      }

      // Apply first-line rule
      if (isFirstNonEmptyLine && line.trim()) {
        const firstLineRule = this.rules.find(r => r.isFirstLine);
        if (firstLineRule) {
          const match = line.match(firstLineRule.pattern);
          if (match) {
            formatted.push(firstLineRule.transform(match));
            isFirstNonEmptyLine = false;
            continue;
          }
        }
        isFirstNonEmptyLine = false;
      }

      // Check if this line should be a list item based on context
      const prevLine = i > 0 ? formatted[formatted.length - 1] : '';
      const prevPrevLine = i > 1 ? formatted[formatted.length - 2] : '';
      
      // Check if we're in a list context (after colon or after another list item)
      const shouldBeList = prevLine && (
        prevLine.endsWith(':') || 
        prevLine.match(/\*\*(Recommendation|Enhancement|Add)\*\*:/) ||
        prevLine.trim().startsWith('-') // Continue list if previous line was a list item
      ) || (prevPrevLine && prevPrevLine.endsWith(':') && prevLine.trim().startsWith('-'));

      // Apply other rules
      for (const rule of this.rules) {
        if (rule.isFirstLine || rule.isMultiLine) continue;

        // Skip list conversion if line already starts with - or is empty or starts with **
        if (rule.contextCheck && (!shouldBeList || line.trim() === '' || line.trim().startsWith('-') || line.trim().startsWith('**'))) {
          continue;
        }

        const match = line.match(rule.pattern);
        if (match) {
          line = rule.transform(match);
          matched = true;
          break;
        }
      }

      formatted.push(line);
    }

    // Second pass: Apply multi-line rules
    let result = formatted.join('\n');
    
    for (const rule of this.rules) {
      if (!rule.isMultiLine) continue;
      
      if (rule.pattern.global) {
        result = result.replace(rule.pattern, rule.transform);
      }
    }

    // Third pass: Clean up
    // Collapse multiple blank lines
    result = result.replace(/\n{3,}/g, '\n\n');
    
    // Ensure blank line before headings
    result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
    
    // Ensure blank line after headings
    result = result.replace(/(#{1,6}\s.+)\n([^#\n])/g, '$1\n\n$2');
    
    // Trim trailing whitespace
    result = result.split('\n').map(l => l.trimEnd()).join('\n');
    
    // Apply semantic line breaks if enabled
    result = this.applySemanticBreaks(result);
    
    // Apply smart typography if enabled
    result = this.applySmartTypography(result);
    
    // Ensure file ends with single newline
    result = result.trim() + '\n';

    return result;
  }

  /**
   * Format a file
   * @param {string} filePath - Path to file
   * @param {Object} options - Options
   */
  async formatFile(filePath, options = {}) {
    const { write = false, quiet = false } = options;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const formatted = this.format(content);
      
      if (write) {
        await fs.writeFile(filePath, formatted);
        if (!quiet) {
          console.log(`✓ Auto-formatted: ${filePath}`);
        }
      }
      
      return { success: true, formatted };
    } catch (error) {
      if (!quiet) {
        console.error(`✗ Error formatting ${filePath}:`, error.message);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Format multiple files
   * @param {string[]} files - Array of file paths
   * @param {Object} options - Options
   */
  async formatFiles(files, options = {}) {
    const results = [];
    
    for (const file of files) {
      const result = await this.formatFile(file, options);
      results.push({ file, ...result });
    }
    
    return results;
  }
}

export { AutoFormatter, defaultRules };
