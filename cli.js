#!/usr/bin/env node

/**
 * CLI tool for markdown formatting and linting
 * Provides commands to format, lint, and check markdown files
 */

import { remark } from 'remark';
import { read } from 'to-vfile';
import { reporter } from 'vfile-reporter';
import remarkPresetLintRecommended from 'remark-preset-lint-recommended';
import remarkPresetLintConsistent from 'remark-preset-lint-consistent';
import remarkPresetLintMarkdownStyleGuide from 'remark-preset-lint-markdown-style-guide';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'mdd'];

// Import configuration from .remarkrc.js
let remarkConfig;
try {
  const configModule = await import(path.join(process.cwd(), '.remarkrc.js'));
  remarkConfig = configModule.default;
} catch (e) {
  console.warn('⚠️  No .remarkrc.js found in current directory, using default config');
  remarkConfig = null;
}

/**
 * Show help text
 */
function showHelp() {
  console.log(`
markdownfix - Opinionated markdown formatter and linter

USAGE:
  markdownfix <command> [options] [files...]

COMMANDS:
  format [files]     Format markdown files (writes changes)
  check [files]      Check formatting without writing changes
  lint [files]       Lint markdown files (no formatting)
  init               Create .remarkrc.js configuration file
  setup              Create example content structure

OPTIONS:
  --help, -h         Show this help message
  --version, -v      Show version number
  --quiet, -q        Suppress output except errors
  --glob <pattern>   Use glob pattern (e.g., "**/*.md")

EXAMPLES:
  # Format all markdown files in current directory
  markdownfix format

  # Check specific files
  markdownfix check README.md docs/*.md

  # Lint with glob pattern
  markdownfix lint --glob "src/**/*.md"

  # Format quietly
  markdownfix format --quiet

  # Initialize configuration
  markdownfix init

For more information, visit: https://github.com/username/markdownfix
`);
}

/**
 * Get files to process
 */
async function getFiles(args, globPattern) {
  if (globPattern) {
    return glob(globPattern, { ignore: 'node_modules/**' });
  }

  if (args.length > 0) {
    return args;
  }

  // Default: find all markdown files in current directory and subdirectories
  const patterns = MARKDOWN_EXTENSIONS.map(ext => `**/*.${ext}`);
  const allFiles = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Process files with remark
 */
async function processFiles(files, options = {}) {
  const { write = false, quiet = false, lintOnly = false } = options;

  let hasErrors = false;
  let processedCount = 0;

  for (const filePath of files) {
    try {
      const file = await read(filePath);

      // Build processor
      let processor = remark()
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkGfm);

      // Add lint presets
      processor = processor
        .use(remarkPresetLintRecommended)
        .use(remarkPresetLintConsistent)
        .use(remarkPresetLintMarkdownStyleGuide);

      // Add stringify for formatting (unless lint-only)
      if (!lintOnly) {
        processor = processor.use(remarkStringify, {
          bullet: '-',
          emphasis: '_',
          fences: true,
          listItemIndent: 'one',
          rule: '-',
          strong: '*',
          tightDefinitions: true
        });
      }

      const result = await processor.process(file);

      // Check for lint errors/warnings
      if (result.messages.length > 0) {
        if (!quiet) {
          console.error(reporter(result));
        }
        hasErrors = true;
      }

      // Write changes if requested and not lint-only
      if (write && !lintOnly) {
        await fs.writeFile(filePath, String(result));
        if (!quiet) {
          console.log(`✓ Formatted: ${filePath}`);
        }
        processedCount++;
      } else if (!write && !lintOnly && !quiet) {
        // Preview mode
        console.log(`\n${'='.repeat(60)}`);
        console.log(`File: ${filePath}`);
        console.log('='.repeat(60));
        console.log(String(result));
      }

    } catch (error) {
      console.error(`✗ Error processing ${filePath}:`, error.message);
      hasErrors = true;
    }
  }

  return { hasErrors, processedCount, totalFiles: files.length };
}

/**
 * Initialize .remarkrc.js configuration
 */
async function initConfig() {
  const configPath = path.join(process.cwd(), '.remarkrc.js');

  try {
    await fs.access(configPath);
    console.log('⚠️  .remarkrc.js already exists');
    return;
  } catch {
    // File doesn't exist, create it
  }

  const configContent = `/**
 * Remark configuration for markdown formatting and linting
 * @see https://github.com/remarkjs/remark
 */

export default {
  plugins: [
    // Frontmatter support
    ['remark-frontmatter', ['yaml']],

    // GitHub Flavored Markdown
    'remark-gfm',

    // Presets
    'remark-preset-lint-recommended',
    'remark-preset-lint-consistent',
    'remark-preset-lint-markdown-style-guide',

    // Formatting rules
    ['remark-lint-emphasis-marker', '_'],
    ['remark-lint-strong-marker', '*'],
    ['remark-lint-unordered-list-marker-style', '-'],
    ['remark-lint-ordered-list-marker-style', '.'],
    ['remark-lint-maximum-line-length', 100],

    // Stringify options for formatting
    ['remark-stringify', {
      bullet: '-',
      emphasis: '_',
      fences: true,
      listItemIndent: 'one',
      rule: '-',
      strong: '*',
      tightDefinitions: true
    }]
  ]
};
`;

  await fs.writeFile(configPath, configContent);
  console.log('✓ Created .remarkrc.js configuration file');
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle version
  if (args.includes('--version') || args.includes('-v')) {
    const pkg = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf-8'));
    console.log(pkg.version);
    return;
  }

  // Handle help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Parse options
  const options = {
    quiet: commandArgs.includes('--quiet') || commandArgs.includes('-q'),
    glob: null
  };

  // Extract glob pattern
  const globIndex = commandArgs.findIndex(arg => arg === '--glob');
  if (globIndex !== -1 && commandArgs[globIndex + 1]) {
    options.glob = commandArgs[globIndex + 1];
  }

  // Filter out option flags to get file arguments
  const fileArgs = commandArgs.filter(arg =>
    !arg.startsWith('--') &&
    !arg.startsWith('-') &&
    arg !== options.glob
  );

  // Execute command
  switch (command) {
    case 'format': {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log('No markdown files found');
        return;
      }
      if (!options.quiet) {
        console.log(`Formatting ${files.length} file(s)...`);
      }
      const result = await processFiles(files, { write: true, quiet: options.quiet });
      if (!options.quiet) {
        console.log(`\n✓ Formatted ${result.processedCount} of ${result.totalFiles} files`);
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case 'check': {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log('No markdown files found');
        return;
      }
      if (!options.quiet) {
        console.log(`Checking ${files.length} file(s)...`);
      }
      const result = await processFiles(files, { write: false, quiet: options.quiet });
      if (!options.quiet) {
        console.log(`\n${result.hasErrors ? '✗' : '✓'} Checked ${result.totalFiles} files`);
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case 'lint': {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log('No markdown files found');
        return;
      }
      if (!options.quiet) {
        console.log(`Linting ${files.length} file(s)...`);
      }
      const result = await processFiles(files, { lintOnly: true, quiet: options.quiet });
      if (!options.quiet) {
        console.log(`\n${result.hasErrors ? '✗' : '✓'} Linted ${result.totalFiles} files`);
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case 'init': {
      await initConfig();
      break;
    }

    case 'setup': {
      // Import and run setup.js
      const setupPath = new URL('./setup.js', import.meta.url);
      await import(setupPath);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "markdownfix --help" for usage information');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
