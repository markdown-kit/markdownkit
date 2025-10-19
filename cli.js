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
import { execSync } from 'child_process';

const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'mdc', 'mdd'];

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
  nuclear [files]    🚀 Run ALL linters and fixers (remark + ESLint)
  init               Create .remarkrc.js configuration file
  setup              Create example content structure

OPTIONS:
  --help, -h         Show this help message
  --version, -v      Show version number
  --quiet, -q        Suppress output except errors
  --glob <pattern>   Use glob pattern (e.g., "**/*.md")
  --nuclear          Run complete lint+fix workflow (alias for nuclear command)

EXAMPLES:
  # Format all markdown files in current directory
  markdownfix format

  # Check specific files
  markdownfix check README.md docs/*.md

  # Lint with glob pattern
  markdownfix lint --glob "src/**/*.md"

  # Format quietly
  markdownfix format --quiet

  # 🚀 Nuclear option - fix EVERYTHING
  markdownfix nuclear
  markdownfix format --nuclear

  # Initialize configuration
  markdownfix init

NUCLEAR MODE:
  The nuclear command runs a comprehensive fix workflow:
  1. Remark formatting (auto-fix markdown syntax)
  2. Remark linting (validate markdown rules)
  3. ESLint auto-fix (fix JavaScript in code blocks)
  4. ESLint linting (validate code quality)

  Perfect for: CI/CD, pre-commit hooks, major cleanups

For more information, visit: https://github.com/entro314-labs/markdownfix
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
 * Run nuclear mode - comprehensive fix workflow
 * Executes: remark format -> remark lint -> eslint fix -> eslint lint
 */
async function runNuclearMode(files, options = {}) {
  const { quiet = false } = options;
  const hasEslint = await checkEslintAvailable();

  if (!quiet) {
    console.log('\n🚀 NUCLEAR MODE ACTIVATED\n');
    console.log(`Processing ${files.length} file(s) with comprehensive workflow...\n`);
  }

  let overallSuccess = true;
  const steps = [];

  // Step 1: Remark formatting
  if (!quiet) console.log('Step 1/4: Running remark formatting...');
  try {
    const result = await processFiles(files, { write: true, quiet: true });
    steps.push({
      name: 'Remark Format',
      success: !result.hasErrors,
      details: `Formatted ${result.processedCount}/${result.totalFiles} files`
    });
    if (result.hasErrors) overallSuccess = false;
    if (!quiet) console.log(`  ✓ Remark formatting completed\n`);
  } catch (error) {
    steps.push({ name: 'Remark Format', success: false, details: error.message });
    overallSuccess = false;
    if (!quiet) console.log(`  ✗ Remark formatting failed: ${error.message}\n`);
  }

  // Step 2: Remark linting
  if (!quiet) console.log('Step 2/4: Running remark linting...');
  try {
    const result = await processFiles(files, { lintOnly: true, quiet: true });
    steps.push({
      name: 'Remark Lint',
      success: !result.hasErrors,
      details: `Linted ${result.totalFiles} files`
    });
    if (result.hasErrors) {
      if (!quiet) console.log('  ⚠️  Remark linting found issues (check output above)\n');
      overallSuccess = false;
    } else {
      if (!quiet) console.log(`  ✓ Remark linting passed\n`);
    }
  } catch (error) {
    steps.push({ name: 'Remark Lint', success: false, details: error.message });
    overallSuccess = false;
    if (!quiet) console.log(`  ✗ Remark linting failed: ${error.message}\n`);
  }

  // Step 3 & 4: ESLint (only if ESLint is available)
  if (hasEslint) {
    const eslintConfigInfo = await getEslintConfigPath();
    const { configPath, source } = eslintConfigInfo;

    if (!quiet && source === 'bundled') {
      console.log('  ℹ️  Using bundled ESLint config (no local config found)\n');
    }

    // Step 3: ESLint auto-fix
    if (!quiet) console.log('Step 3/4: Running ESLint auto-fix...');
    try {
      const fileList = files.join(' ');
      const eslintCmd = `npx eslint --config "${configPath}" --fix ${fileList}`;

      try {
        execSync(eslintCmd, {
          stdio: quiet ? 'pipe' : 'inherit',
          cwd: process.cwd()
        });
        steps.push({ name: 'ESLint Fix', success: true, details: 'Auto-fixed code blocks' });
        if (!quiet) console.log(`  ✓ ESLint auto-fix completed\n`);
      } catch (eslintError) {
        // ESLint returns non-zero even if it fixes issues
        steps.push({ name: 'ESLint Fix', success: false, details: 'Some issues could not be auto-fixed' });
        if (!quiet) console.log(`  ⚠️  ESLint auto-fix completed with warnings\n`);
      }
    } catch (error) {
      steps.push({ name: 'ESLint Fix', success: false, details: error.message });
      if (!quiet) console.log(`  ✗ ESLint auto-fix failed: ${error.message}\n`);
    }

    // Step 4: ESLint linting
    if (!quiet) console.log('Step 4/4: Running ESLint linting...');
    try {
      const fileList = files.join(' ');
      const eslintCmd = `npx eslint --config "${configPath}" ${fileList}`;

      execSync(eslintCmd, {
        stdio: quiet ? 'pipe' : 'inherit',
        cwd: process.cwd()
      });
      steps.push({ name: 'ESLint Lint', success: true, details: 'All code blocks valid' });
      if (!quiet) console.log(`  ✓ ESLint linting passed\n`);
    } catch (eslintError) {
      steps.push({ name: 'ESLint Lint', success: false, details: 'Linting issues found' });
      overallSuccess = false;
      if (!quiet) console.log(`  ⚠️  ESLint linting found issues\n`);
    }
  } else {
    // ESLint not installed
    if (!quiet) {
      console.log('Step 3/4: Skipping ESLint (not installed)');
      console.log('  ℹ️  Install ESLint with: npm install -D eslint eslint-plugin-mdx\n');
      console.log('Step 4/4: Skipping ESLint linting\n');
    }
    steps.push({ name: 'ESLint Fix', success: true, details: 'Skipped (not installed)' });
    steps.push({ name: 'ESLint Lint', success: true, details: 'Skipped (not installed)' });
  }

  // Summary
  if (!quiet) {
    console.log('═'.repeat(60));
    console.log('NUCLEAR MODE SUMMARY');
    console.log('═'.repeat(60));
    steps.forEach(step => {
      const icon = step.success ? '✓' : '✗';
      const status = step.success ? 'PASS' : 'FAIL';
      console.log(`${icon} ${step.name.padEnd(20)} ${status.padEnd(6)} ${step.details}`);
    });
    console.log('═'.repeat(60));
    if (overallSuccess) {
      console.log('🎉 All checks passed! Your markdown is pristine.\n');
    } else {
      console.log('⚠️  Some issues remain. Review the output above.\n');
    }
  }

  return { success: overallSuccess, steps };
}

/**
 * Check if ESLint is available in the project
 */
async function checkEslintAvailable() {
  try {
    execSync('npx eslint --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get ESLint config path
 * Returns local config if it exists, otherwise uses bundled config
 * Since ESLint dependencies are included in the package, bundled config always works
 */
async function getEslintConfigPath() {
  const localConfig = path.join(process.cwd(), 'eslint.config.js');

  try {
    await fs.access(localConfig);
    // Local config exists - use it
    return { configPath: localConfig, source: 'local' };
  } catch {
    // Use bundled config - dependencies are always available
    const bundledConfig = new URL('./eslint.config.js', import.meta.url).pathname;
    return { configPath: bundledConfig, source: 'bundled' };
  }
}/**
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
    nuclear: commandArgs.includes('--nuclear'),
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

      // Check for --nuclear flag
      if (options.nuclear) {
        const result = await runNuclearMode(files, { quiet: options.quiet });
        process.exit(result.success ? 0 : 1);
        break;
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

    case 'nuclear': {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log('No markdown files found');
        return;
      }
      const result = await runNuclearMode(files, { quiet: options.quiet });
      process.exit(result.success ? 0 : 1);
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
