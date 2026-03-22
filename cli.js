#!/usr/bin/env node

/**
 * CLI tool for markdown formatting and linting
 * Provides commands to format, lint, and check markdown files
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { glob } from 'glob'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkPresetLintConsistent from 'remark-preset-lint-consistent'
import remarkPresetLintMarkdownStyleGuide from 'remark-preset-lint-markdown-style-guide'
import remarkPresetLintRecommended from 'remark-preset-lint-recommended'
import remarkStringify from 'remark-stringify'
import remarkTypography from 'remark-typography'
import { read } from 'to-vfile'
import { reporter } from 'vfile-reporter'

import { TextProcessor } from './text-processor.js'

const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'mdc', 'mdd']
const TEXT_EXTENSIONS_PATTERN = '**/*.{txt,md,mdx,mdc,mdd}'
const VALUE_OPTIONS = new Set(['--glob', '--width', '--header-level', '--plugins'])
const DEFAULT_CONCURRENCY = 4

let remarkConfigLoaded = false

/**
 * Run async work items with a fixed concurrency limit.
 */
async function mapWithConcurrency(items, concurrency, worker) {
  if (items.length === 0) {
    return []
  }

  const normalizedConcurrency = Math.max(1, Math.min(concurrency, items.length))
  const results = Array.from({ length: items.length })
  let cursor = 0

  async function runWorker() {
    while (true) {
      const currentIndex = cursor
      cursor += 1
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: normalizedConcurrency }, runWorker))
  return results
}

/**
 * Parse command arguments into flags, option values, and positional arguments.
 */
function parseCommandArgs(commandArgs) {
  const flags = new Set()
  const values = new Map()
  const positional = []

  for (let i = 0; i < commandArgs.length; i++) {
    const arg = commandArgs[i]

    if (VALUE_OPTIONS.has(arg)) {
      const value = commandArgs[i + 1]
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for option: ${arg}`)
      }
      values.set(arg, value)
      i += 1
      continue
    }

    if (arg.startsWith('--')) {
      flags.add(arg)
      continue
    }

    if (arg.startsWith('-') && arg.length > 1) {
      for (const shortFlag of arg.slice(1)) {
        flags.add(`-${shortFlag}`)
      }
      continue
    }

    positional.push(arg)
  }

  return { flags, values, positional }
}

/**
 * Lazily load project-level .remarkrc.js if present.
 */
async function ensureRemarkConfigLoaded(options = {}) {
  const { quiet = false } = options

  if (remarkConfigLoaded) {
    return
  }

  const originalLog = console.log
  const originalInfo = console.info
  console.log = () => {}
  console.info = () => {}

  try {
    await import(path.join(process.cwd(), '.remarkrc.js'))
  } catch {
    if (!quiet) {
      console.log = originalLog
      console.info = originalInfo
      console.warn('⚠️  No .remarkrc.js found in current directory, using default config')
      console.log = () => {}
      console.info = () => {}
    }
  } finally {
    console.log = originalLog
    console.info = originalInfo
    remarkConfigLoaded = true
  }
}

/**
 * Resolve file targets for text-transforming commands (autoformat, draft).
 */
async function resolveTextInputFiles(fileArgs, options = {}) {
  const { globPattern = null, recursive = false } = options

  if (globPattern) {
    return glob(globPattern, { ignore: ['node_modules/**', '.git/**'] })
  }

  if (fileArgs.length === 0) {
    return glob(TEXT_EXTENSIONS_PATTERN, {
      ignore: ['node_modules/**', '.git/**'],
    })
  }

  const filesToProcess = []

  for (const inputPath of fileArgs) {
    let stat
    try {
      stat = await fs.stat(inputPath)
    } catch {
      throw new Error(`Cannot access ${inputPath}`)
    }

    if (stat.isDirectory()) {
      if (!recursive) {
        throw new Error(`${inputPath} is a directory. Use --recursive to process directories.`)
      }

      const pattern = path.join(inputPath, TEXT_EXTENSIONS_PATTERN)
      const dirFiles = await glob(pattern, {
        ignore: ['node_modules/**', '.git/**'],
      })
      filesToProcess.push(...dirFiles)
    } else {
      filesToProcess.push(inputPath)
    }
  }

  return filesToProcess
}

/**
 * Load autoformat plugin rules from a plugin file or directory.
 */
async function loadAutoformatPlugins(pluginsPath, options = {}) {
  const { quiet = false } = options

  if (!pluginsPath) {
    return []
  }

  const resolvedPath = path.resolve(pluginsPath)

  let stat
  try {
    stat = await fs.stat(resolvedPath)
  } catch {
    throw new Error(`Cannot access plugins path: ${pluginsPath}`)
  }

  let pluginFiles = []
  if (stat.isDirectory()) {
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
    pluginFiles = entries
      .filter((entry) => entry.isFile() && /\.(mjs|cjs|js)$/i.test(entry.name))
      .map((entry) => path.join(resolvedPath, entry.name))
      .sort()
  } else if (stat.isFile()) {
    pluginFiles = [resolvedPath]
  } else {
    throw new Error(`Unsupported plugins path: ${pluginsPath}`)
  }

  if (pluginFiles.length === 0) {
    throw new Error(`No plugin files found in: ${pluginsPath}`)
  }

  const rules = []

  for (const pluginFile of pluginFiles) {
    let module
    try {
      module = await import(pathToFileURL(pluginFile).href)
    } catch (err) {
      throw new Error(`Failed to load plugin file ${pluginFile}: ${err.message}`)
    }

    const plugin = module.default ?? module
    if (!plugin || !Array.isArray(plugin.rules)) {
      throw new Error(`Invalid plugin shape in ${pluginFile}: expected { rules: [] }`)
    }

    for (const rule of plugin.rules) {
      if (!rule || typeof rule.transform !== 'function') {
        throw new Error(`Invalid rule in ${pluginFile}: every rule must include a transform()`)
      }

      if (!rule.isMultiLine && !(rule.pattern instanceof RegExp)) {
        throw new Error(
          `Invalid rule in ${pluginFile}: non-multiLine rules must include a RegExp pattern`,
        )
      }

      rules.push(rule)
    }

    if (!quiet) {
      console.log(`✓ Loaded plugin: ${path.basename(pluginFile)}`)
    }
  }

  return rules
}

/**
 * Format multiple files using a TextProcessor instance
 * @param {TextProcessor} processor - Configured TextProcessor
 * @param {string[]} files - Array of file paths
 * @param {Object} options - { write: boolean, quiet: boolean }
 * @returns {Promise<Array<{file: string, success: boolean, error?: string}>>}
 */
async function formatFiles(processor, files, options = {}) {
  const { write = false, quiet = false, concurrency = DEFAULT_CONCURRENCY } = options

  const results = await mapWithConcurrency(files, concurrency, async (file) => {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const formatted = await processor.process(content)
      if (write) {
        await fs.writeFile(file, formatted, 'utf-8')
      }
      return { file, success: true }
    } catch (err) {
      return { file, success: false, error: err.message }
    }
  })

  if (!quiet) {
    for (const result of results) {
      if (result.success) {
        if (write) {
          console.log(`✓ Formatted: ${result.file}`)
        }
      } else {
        console.error(`✗ Error processing ${result.file}: ${result.error}`)
      }
    }
  }

  return results
}

/**
 * Show help text
 */
function showHelp() {
  console.log(`
markdownkit - Opinionated markdown formatter and linter

USAGE:
  markdownkit <command> [options] [files...]

COMMANDS:
  format [files]     Format markdown files (writes changes)
  check [files]      Check formatting without writing changes
  lint [files]       Lint markdown files (no formatting)
  nuclear [files]    🚀 Run ALL linters and fixers (remark + oxlint-mdx)
  autoformat [files] 🤖 Convert plain text to structured markdown
  draft [files]      📝 Transform rough text to markdown (aggressive mode)
  init               Create .remarkrc.js configuration file
  setup              Create example content structure

OPTIONS:
  --help, -h         Show this help message
  --version, -v      Show version number
  --quiet, -q        Suppress output except errors
  --glob <pattern>   Use glob pattern (e.g., "**/*.md")
  --nuclear          Run complete lint+fix workflow (alias for nuclear command)

AUTOFORMAT OPTIONS:
  --plugins <path>   Load custom formatting plugins (directory or file)
  --recursive, -r    Process directories recursively
  --semantic         Apply semantic line breaks at sentence boundaries
  --smart-quotes     Convert straight quotes to curly quotes
  --ellipsis         Convert ... to ellipsis character (…)
  --width <n>        Set line wrap width (default: 88)
  --auto             Enable all smart features (semantic + quotes + ellipsis)

DRAFT OPTIONS:
  --header-level <n> Set header level for folder syntax (default: 3)
  --dry-run          Preview output without writing files
  --polish           Run remark pipeline after draft transformation

EXAMPLES:
  # Format all markdown files in current directory
  markdownkit format

  # Check specific files
  markdownkit check README.md docs/*.md

  # Lint with glob pattern
  markdownkit lint --glob "src/**/*.md"

  # Format quietly
  markdownkit format --quiet

  # 🚀 Nuclear option - fix EVERYTHING
  markdownkit nuclear
  markdownkit format --nuclear

  # 🤖 Auto-format plain text to markdown
  markdownkit autoformat unformatted.txt
  markdownkit autoformat --glob "**/*.txt"
  markdownkit autoformat --auto unformatted.txt
  markdownkit autoformat --semantic --smart-quotes file.md
  markdownkit autoformat --plugins ./my-plugins --width 100

  # 📝 Draft mode - transform rough text to markdown
  markdownkit draft notes.txt
  markdownkit draft --header-level 2 rough-doc.txt
  markdownkit draft --polish --dry-run messy-notes.md

  # Initialize configuration
  markdownkit init

NUCLEAR MODE:
  The nuclear command runs a comprehensive fix workflow:
  1. Autoformat polish (safe text normalization)
  2. Remark formatting (auto-fix markdown syntax)
  3. oxlint-mdx auto-fix (fix code blocks and MDX expressions)
  4. Final validation (report remaining issues)

  Perfect for: CI/CD, pre-commit hooks, major cleanups

For more information, visit: https://github.com/entro314-labs/markdownkit
`)
}

/**
 * Get files to process
 */
async function getFiles(args, globPattern) {
  if (globPattern) {
    return glob(globPattern, { ignore: 'node_modules/**' })
  }

  if (args.length > 0) {
    return args
  }

  // Default: find all markdown files in current directory and subdirectories
  const patterns = MARKDOWN_EXTENSIONS.map((ext) => `**/*.${ext}`)
  const allFiles = []

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['node_modules/**', '.git/**'],
    })
    allFiles.push(...files)
  }

  return allFiles
}

/**
 * Create a configured remark processor
 */
function createRemarkProcessor(options = {}) {
  const { lintOnly = false, typography = false } = options

  // Build processor
  let processor = remark().use(remarkFrontmatter, ['yaml']).use(remarkGfm)

  // Add lint presets
  processor = processor
    .use(remarkPresetLintRecommended)
    .use(remarkPresetLintConsistent)
    .use(remarkPresetLintMarkdownStyleGuide)

  if (typography) {
    processor = processor.use(remarkTypography)
  }

  // Add stringify for formatting (unless lint-only)
  if (!lintOnly) {
    processor = processor.use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      fences: true,
      listItemIndent: 'one',
      rule: '-',
      strong: '*',
      tightDefinitions: true,
      handlers: {
        break: () => '  \n',
      },
    })
  }

  return processor
}

/**
 * Process files with remark
 */
async function processFiles(files, options = {}) {
  const {
    write = false,
    quiet = false,
    lintOnly = false,
    typography = false,
    concurrency = DEFAULT_CONCURRENCY,
  } = options

  await ensureRemarkConfigLoaded({ quiet })

  let hasErrors = false
  let processedCount = 0

  const outcomes = await mapWithConcurrency(files, concurrency, async (filePath) => {
    try {
      const file = await read(filePath)
      let processor = createRemarkProcessor({ lintOnly, typography })

      if (!lintOnly && (filePath.endsWith('.mdx') || filePath.endsWith('.mdd'))) {
        processor = processor.use(remarkStringify, {
          bullet: '-',
          emphasis: '_',
          fences: false,
          listItemIndent: 'one',
          rule: '-',
          strong: '*',
          tightDefinitions: true,
          handlers: {
            break: () => '  \n',
          },
        })
      }

      const result = await processor.process(file)
      const reportText = result.messages.length > 0 ? reporter(result) : null
      const outputText = String(result)

      if (write && !lintOnly) {
        await fs.writeFile(filePath, outputText)
      }

      return {
        filePath,
        success: true,
        reportText,
        outputText,
      }
    } catch (err) {
      return {
        filePath,
        success: false,
        error: err.message,
      }
    }
  })

  for (const outcome of outcomes) {
    if (!outcome.success) {
      if (!quiet) {
        console.error(`✗ Error processing ${outcome.filePath}: ${outcome.error}`)
      }
      hasErrors = true
      continue
    }

    if (outcome.reportText) {
      if (!quiet) {
        console.error(outcome.reportText)
      }
      hasErrors = true
    }

    if (write && !lintOnly) {
      processedCount += 1
      if (!quiet) {
        console.log(`✓ Formatted: ${outcome.filePath}`)
      }
      continue
    }

    if (!write && !lintOnly && !quiet) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`File: ${outcome.filePath}`)
      console.log('='.repeat(60))
      console.log(outcome.outputText)
    }
  }

  return { hasErrors, processedCount, totalFiles: files.length }
}

/**
 * Run nuclear mode - comprehensive fix workflow
 * Executes: autoformat polish -> remark format -> oxlint-mdx fix -> final validation
 */
async function runNuclearMode(files, options = {}) {
  const { quiet = false } = options
  const hasOxlintMdx = await checkOxlintMdxAvailable()
  const filteredFiles = files

  if (!quiet) {
    console.log('\n🚀 NUCLEAR MODE ACTIVATED\n')
    console.log(`Processing ${filteredFiles.length} file(s) with comprehensive workflow...\n`)
  }

  let overallSuccess = true
  const steps = []

  // Step 1: Autoformat Polish (Safe NLP & Structure)
  if (!quiet) console.log('Step 1/4: Running autoformat polish...')
  try {
    const processor = new TextProcessor({
      nlp: false,
      semanticBreaks: false,
      smartQuotes: true,
      smartEllipsis: true,
      firstLineTitle: false,
      detectLabels: false,
    })

    const results = await formatFiles(processor, filteredFiles, {
      write: true,
      quiet: true,
    })

    const successCount = results.filter((r) => r.success).length

    steps.push({
      name: 'Autoformat Polish',
      success: true,
      details: `Polished ${successCount} files`,
    })

    if (!quiet) console.log(`  ✓ Polished ${successCount} file(s)\n`)
  } catch (err) {
    steps.push({
      name: 'Autoformat Polish',
      success: false,
      details: err.message,
    })
    if (!quiet) console.log(`  ✗ Autoformat polish failed: ${err.message}\n`)
  }

  // Step 2: Remark formatting (auto-fix markdown syntax)
  if (!quiet) console.log('Step 2/4: Running remark formatting...')
  try {
    const result = await processFiles(filteredFiles, {
      write: true,
      quiet: true,
    })
    const formatted = result.processedCount
    const withIssues = result.hasErrors

    steps.push({
      name: 'Remark Format',
      success: formatted > 0,
      details: `Formatted ${formatted}/${result.totalFiles} files`,
    })

    if (!quiet) {
      console.log(`  ✓ Formatted ${formatted} file(s)`)
      if (withIssues) {
        console.log(`  ℹ️  Some issues require manual fixes\n`)
      } else {
        console.log()
      }
    }
  } catch (err) {
    steps.push({
      name: 'Remark Format',
      success: false,
      details: err.message,
    })
    overallSuccess = false
    if (!quiet) console.log(`  ✗ Remark formatting failed: ${err.message}\n`)
  }

  // Step 3: oxlint-mdx auto-fix (only if available)
  if (hasOxlintMdx) {
    if (!quiet) console.log('Step 3/4: Running oxlint-mdx auto-fix...')
    try {
      const fileList = filteredFiles.map((f) => `"${f}"`).join(' ')
      const oxlintMdxCmd = `npx oxlint-mdx --fix ${fileList}`
      execSync(oxlintMdxCmd, { stdio: 'pipe' })
      steps.push({
        name: 'oxlint-mdx Fix',
        success: true,
        details: 'Fixed markdown/MDX code issues',
      })
      if (!quiet) console.log(`  ✓ oxlint-mdx auto-fix completed\n`)
    } catch (err) {
      const output = err.stdout?.toString() ?? err.stderr?.toString() ?? ''
      const hasWarnings = output.includes('warning')
      const hasErrors = output.includes('error')

      if (hasErrors || hasWarnings) {
        steps.push({
          name: 'oxlint-mdx Fix',
          success: false,
          details: 'Some issues remain',
        })
        if (!quiet) console.log(`  ⚠️  oxlint-mdx found issues that need manual fixes\n`)
      } else {
        steps.push({
          name: 'oxlint-mdx Fix',
          success: false,
          details: err.message,
        })
        if (!quiet) console.log(`  ✗ oxlint-mdx auto-fix failed: ${err.message}\n`)
      }

      overallSuccess = false
    }
  } else {
    if (!quiet) {
      console.log('Step 3/4: Skipping oxlint-mdx (not installed)')
      console.log('  ℹ️  Install with: npm install -D @markdownkit/oxlint-mdx\n')
    }
    steps.push({
      name: 'oxlint-mdx Fix',
      success: true,
      details: 'Skipped (not installed)',
    })
  }

  // Step 4: Final validation
  if (!quiet) console.log('Step 4/4: Running final validation...')
  let validationResult
  try {
    validationResult = await processFiles(filteredFiles, {
      lintOnly: true,
      quiet: true,
    })
    const hasIssues = validationResult.hasErrors

    if (hasIssues) {
      overallSuccess = false
    }

    steps.push({
      name: 'Validation',
      success: !hasIssues,
      details: hasIssues ? 'Issues found' : 'All checks passed',
    })

    if (!quiet) {
      if (hasIssues) {
        console.log(`  ⚠️  Validation found remaining issues\n`)
      } else {
        console.log(`  ✓ All validation checks passed\n`)
      }
    }
  } catch (err) {
    steps.push({ name: 'Validation', success: false, details: err.message })
    overallSuccess = false
    if (!quiet) console.log(`  ✗ Validation failed: ${err.message}\n`)
  }

  // Show detailed issues if validation failed
  if (!quiet && validationResult?.hasErrors) {
    console.log('═'.repeat(60))
    console.log('REMAINING ISSUES')
    console.log('═'.repeat(60))
    await processFiles(filteredFiles, { lintOnly: true, quiet: false })
    console.log()
  }

  // Summary
  if (!quiet) {
    console.log('═'.repeat(60))
    console.log('NUCLEAR MODE SUMMARY')
    console.log('═'.repeat(60))
    steps.forEach((step) => {
      const icon = step.success ? '✓' : '⚠️'
      const status = step.success ? 'PASS' : 'NEEDS ATTENTION'
      console.log(`${icon} ${step.name.padEnd(20)} ${status.padEnd(16)} ${step.details}`)
    })
    console.log('═'.repeat(60))

    if (overallSuccess) {
      console.log('🎉 All checks passed! Your markdown is pristine.\n')
    } else {
      console.log('\n📋 NEXT STEPS:')
      console.log('   Review the issues above and fix them manually.')
      console.log('   Common fixes:')
      console.log('   • Shorten long lines (max 80 chars)')
      console.log('   • Add language flags to code blocks (```js, ```bash, etc.)')
      console.log('   • Fix filename issues (use lowercase, avoid special chars)')
      console.log('   • Add blank lines between list items\n')
    }
  }

  return { success: overallSuccess, steps }
}

/**
 * Check if oxlint-mdx is available in the project
 */
async function checkOxlintMdxAvailable() {
  try {
    execSync('npx --no-install oxlint-mdx --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Initialize .remarkrc.js configuration
 */
async function initConfig() {
  const configPath = path.join(process.cwd(), '.remarkrc.js')

  try {
    await fs.access(configPath)
    console.log('⚠️  .remarkrc.js already exists')
    return
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
`

  await fs.writeFile(configPath, configContent)
  console.log('✓ Created .remarkrc.js configuration file')
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  // Handle version
  if (args.includes('--version') || args.includes('-v')) {
    const pkg = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf-8'))
    console.log(pkg.version)
    return
  }

  // Handle help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }

  const command = args[0]
  const commandArgs = args.slice(1)

  let parsedArgs
  try {
    parsedArgs = parseCommandArgs(commandArgs)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }

  // Parse options
  const options = {
    quiet: parsedArgs.flags.has('--quiet') || parsedArgs.flags.has('-q'),
    nuclear: parsedArgs.flags.has('--nuclear'),
    glob: parsedArgs.values.get('--glob') ?? null,
  }

  // Filter out option flags to get file arguments
  const fileArgs = parsedArgs.positional

  // Execute command
  switch (command) {
    case 'format': {
      const files = await getFiles(fileArgs, options.glob)
      if (files.length === 0) {
        console.log('No markdown files found')
        return
      }

      // Check for --nuclear flag
      if (options.nuclear) {
        const result = await runNuclearMode(files, { quiet: options.quiet })
        process.exit(result.success ? 0 : 1)
        break
      }

      if (!options.quiet) {
        console.log(`Formatting ${files.length} file(s)...`)
      }
      const result = await processFiles(files, {
        write: true,
        quiet: options.quiet,
      })
      if (!options.quiet) {
        console.log(`\n✓ Formatted ${result.processedCount} of ${result.totalFiles} files`)
      }
      process.exit(result.hasErrors ? 1 : 0)
      break
    }

    case 'check': {
      const files = await getFiles(fileArgs, options.glob)
      if (files.length === 0) {
        console.log('No markdown files found')
        return
      }
      if (!options.quiet) {
        console.log(`Checking ${files.length} file(s)...`)
      }
      const result = await processFiles(files, {
        write: false,
        quiet: options.quiet,
      })
      if (!options.quiet) {
        console.log(`\n${result.hasErrors ? '✗' : '✓'} Checked ${result.totalFiles} files`)
      }
      process.exit(result.hasErrors ? 1 : 0)
      break
    }

    case 'lint': {
      const files = await getFiles(fileArgs, options.glob)
      if (files.length === 0) {
        console.log('No markdown files found')
        return
      }
      if (!options.quiet) {
        console.log(`Linting ${files.length} file(s)...`)
      }
      const result = await processFiles(files, {
        lintOnly: true,
        quiet: options.quiet,
      })
      if (!options.quiet) {
        console.log(`\n${result.hasErrors ? '✗' : '✓'} Linted ${result.totalFiles} files`)
      }
      process.exit(result.hasErrors ? 1 : 0)
      break
    }

    case 'init': {
      await initConfig()
      break
    }

    case 'setup': {
      // Import and run setup.js
      const setupPath = new URL('./setup.js', import.meta.url)
      const { setup } = await import(setupPath)
      await setup()
      break
    }

    case 'nuclear': {
      const files = await getFiles(fileArgs, options.glob)
      if (files.length === 0) {
        console.log('No markdown files found')
        return
      }
      const result = await runNuclearMode(files, { quiet: options.quiet })
      process.exit(result.success ? 0 : 1)
      break
    }

    case 'autoformat': {
      // Parse autoformat-specific options
      const recursive = parsedArgs.flags.has('--recursive') || parsedArgs.flags.has('-r')

      // Parse typography and formatting options
      const autoMode = parsedArgs.flags.has('--auto')
      const semanticBreaks = autoMode || parsedArgs.flags.has('--semantic')
      const smartQuotes = autoMode || parsedArgs.flags.has('--smart-quotes')
      const ellipsis = autoMode || parsedArgs.flags.has('--ellipsis')

      const pluginsPath = parsedArgs.values.get('--plugins') ?? null

      // Parse width option
      let wrapWidth = 88
      const widthValue = parsedArgs.values.get('--width')
      if (widthValue) {
        wrapWidth = Number.parseInt(widthValue, 10)
      }

      if (!Number.isFinite(wrapWidth) || wrapWidth <= 0) {
        console.error(`Error: Invalid --width value: ${widthValue}`)
        process.exit(1)
      }

      // Get files to process
      let filesToProcess
      try {
        filesToProcess = await resolveTextInputFiles(fileArgs, {
          globPattern: options.glob,
          recursive,
        })
      } catch (err) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }

      if (filesToProcess.length === 0) {
        console.log('No files found to auto-format')
        return
      }

      let customRules = []
      try {
        customRules = await loadAutoformatPlugins(pluginsPath, { quiet: options.quiet })
      } catch (err) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }

      if (!options.quiet) {
        console.log(`\n🤖 AUTO-FORMAT MODE\n`)
        console.log(`Processing ${filesToProcess.length} file(s)...\n`)
      }

      // Initialize text processor with options
      const processor = new TextProcessor({
        nlp: false,
        firstLineTitle: true,
        detectLabels: true,
        semanticBreaks,
        smartQuotes,
        smartEllipsis: ellipsis,
        wrapWidth,
        customRules,
      })

      // Format files
      const results = await formatFiles(processor, filesToProcess, {
        write: true,
        quiet: options.quiet,
      })

      // Summary
      const successful = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      if (!options.quiet) {
        console.log(`\n${'═'.repeat(60)}`)
        console.log('AUTO-FORMAT SUMMARY')
        console.log('═'.repeat(60))
        console.log(`✓ Successfully formatted: ${successful} file(s)`)
        if (failed > 0) {
          console.log(`✗ Failed: ${failed} file(s)`)
        }
        console.log('═'.repeat(60))
        console.log()
      }

      process.exit(failed > 0 ? 1 : 0)
      break
    }

    case 'draft': {
      // Parse draft-specific options
      const dryRun = parsedArgs.flags.has('--dry-run')
      const polish = parsedArgs.flags.has('--polish')
      const recursive = parsedArgs.flags.has('--recursive') || parsedArgs.flags.has('-r')

      // Parse header level option
      let headerLevel = 3
      const headerLevelValue = parsedArgs.values.get('--header-level')
      if (headerLevelValue) {
        headerLevel = Number.parseInt(headerLevelValue, 10)
      }

      if (!Number.isInteger(headerLevel) || headerLevel < 1 || headerLevel > 6) {
        console.error(`Error: Invalid --header-level value: ${headerLevelValue}`)
        process.exit(1)
      }

      // Get files to process
      let filesToProcess
      try {
        filesToProcess = await resolveTextInputFiles(fileArgs, {
          globPattern: options.glob,
          recursive,
        })
      } catch (err) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }

      if (filesToProcess.length === 0) {
        console.log('No files found to process')
        return
      }

      if (!options.quiet) {
        console.log(`\n📝 DRAFT MODE\n`)
        console.log(
          `Processing ${filesToProcess.length} file(s) with aggressive structure detection...\n`,
        )
      }

      // Initialize text processor with draft mode enabled
      const processor = new TextProcessor({
        nlp: true,
        firstLineTitle: true,
        smartTitleDetection: true,
        normalizeHeadings: true,
        detectLabels: true,
        detectFolders: true,
        detectLists: true,
        reflowParagraphs: true,
        correctCommonTypos: true,
        headerLevel,
      })

      if (dryRun) {
        // Preview mode - show output without writing
        for (const filePath of filesToProcess) {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            // Use async format for full NLP processing
            const formatted = await processor.process(content)

            // Optionally run through remark pipeline
            let finalContent = formatted
            if (polish) {
              await ensureRemarkConfigLoaded({ quiet: options.quiet })
              const processor = createRemarkProcessor({ lintOnly: false, typography: true })

              // Handle MDX/MDD specifics for polish if needed
              if (filePath.endsWith('.mdx') || filePath.endsWith('.mdd')) {
                processor.use(remarkStringify, {
                  bullet: '-',
                  emphasis: '_',
                  fences: false,
                  listItemIndent: 'one',
                  rule: '-',
                  strong: '*',
                  tightDefinitions: true,
                  handlers: { break: () => '  \n' },
                })
              }

              const result = await processor.process({ path: filePath, value: formatted })
              finalContent = String(result)
            }

            console.log(`\n${'═'.repeat(60)}`)
            console.log(`File: ${filePath}`)
            console.log('═'.repeat(60))
            console.log(finalContent)
          } catch (err) {
            console.error(`✗ Error processing ${filePath}:`, err.message)
          }
        }
        return
      }

      // Write mode
      const results = await formatFiles(processor, filesToProcess, {
        write: true,
        quiet: options.quiet,
      })

      // If polish is enabled, run remark on the formatted files
      if (polish) {
        if (!options.quiet) {
          console.log(`\n🔧 Running remark polish on draft output...\n`)
        }
        await processFiles(filesToProcess, {
          write: true,
          quiet: options.quiet,
          typography: true,
        })
      }

      // Summary
      const successful = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      if (!options.quiet) {
        console.log(`\n${'═'.repeat(60)}`)
        console.log('DRAFT MODE SUMMARY')
        console.log('═'.repeat(60))
        console.log(`✓ Successfully transformed: ${successful} file(s)`)
        if (failed > 0) {
          console.log(`✗ Failed: ${failed} file(s)`)
        }
        if (polish) {
          console.log(`✓ Remark polish applied`)
        }
        console.log('═'.repeat(60))
        console.log()
      }

      process.exit(failed > 0 ? 1 : 0)
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Run "markdownkit --help" for usage information')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
