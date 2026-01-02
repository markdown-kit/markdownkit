#!/usr/bin/env node

/**
 * CLI tool for markdown formatting and linting
 * Provides commands to format, lint, and check markdown files
 */

import { remark } from "remark";
import { read } from "to-vfile";
import { reporter } from "vfile-reporter";
import remarkPresetLintRecommended from "remark-preset-lint-recommended";
import remarkPresetLintConsistent from "remark-preset-lint-consistent";
import remarkPresetLintMarkdownStyleGuide from "remark-preset-lint-markdown-style-guide";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { execSync } from "child_process";
import { AutoFormatter } from "./autoformat.js";

const MARKDOWN_EXTENSIONS = ["md", "mdx", "mdc", "mdd"];

// Import configuration from .remarkrc.js
// Suppress console output during import to avoid MDD warnings in nuclear mode
const originalLog = console.log;
const originalInfo = console.info;
console.log = () => {};
console.info = () => {};

let remarkConfig;
try {
  const configModule = await import(path.join(process.cwd(), ".remarkrc.js"));
  remarkConfig = configModule.default;
} catch (e) {
  // Restore console before warning
  console.log = originalLog;
  console.info = originalInfo;
  console.warn(
    "⚠️  No .remarkrc.js found in current directory, using default config",
  );
  remarkConfig = null;
}

// Restore console
console.log = originalLog;
console.info = originalInfo;

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
  nuclear [files]    🚀 Run ALL linters and fixers (remark + ESLint)
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
  --plugins <dir>    Load custom formatting plugins
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
  1. Remark formatting (auto-fix markdown syntax)
  2. ESLint auto-fix (fix JavaScript/JSX in code blocks)
  3. Final validation (report remaining issues)

  Perfect for: CI/CD, pre-commit hooks, major cleanups

For more information, visit: https://github.com/entro314-labs/markdownkit
`);
}

/**
 * Get files to process
 */
async function getFiles(args, globPattern) {
  if (globPattern) {
    return glob(globPattern, { ignore: "node_modules/**" });
  }

  if (args.length > 0) {
    return args;
  }

  // Default: find all markdown files in current directory and subdirectories
  const patterns = MARKDOWN_EXTENSIONS.map((ext) => `**/*.${ext}`);
  const allFiles = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ["node_modules/**", ".git/**"],
    });
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
      let processor = remark().use(remarkFrontmatter, ["yaml"]).use(remarkGfm);

      // Add lint presets
      processor = processor
        .use(remarkPresetLintRecommended)
        .use(remarkPresetLintConsistent)
        .use(remarkPresetLintMarkdownStyleGuide);

      // Add stringify for formatting (unless lint-only)
      if (!lintOnly) {
        // For MDX files, disable fences to prevent JSX from being wrapped in code blocks
        const isMdx = filePath.endsWith(".mdx") || filePath.endsWith(".mdd");
        processor = processor.use(remarkStringify, {
          bullet: "-",
          emphasis: "_",
          fences: !isMdx, // Disable fences for MDX to preserve JSX
          listItemIndent: "one",
          rule: "-",
          strong: "*",
          tightDefinitions: true,
          handlers: {
            // Custom handler to use two spaces for line breaks instead of backslashes
            break: () => "  \n",
          },
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
        console.log(`\n${"=".repeat(60)}`);
        console.log(`File: ${filePath}`);
        console.log("=".repeat(60));
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
 * Executes: remark format -> eslint fix -> final validation
 */
async function runNuclearMode(files, options = {}) {
  const { quiet = false } = options;
  const hasEslint = await checkEslintAvailable();

  // Filter out ESLint-ignored files in nuclear mode
  let filteredFiles = files;
  let ignoredCount = 0;
  if (hasEslint) {
    const ignorePatterns = await getEslintIgnorePatterns();
    const originalCount = files.length;
    filteredFiles = files.filter(
      (file) => !isFileIgnored(file, ignorePatterns),
    );
    ignoredCount = originalCount - filteredFiles.length;
  }

  if (!quiet) {
    console.log("\n🚀 NUCLEAR MODE ACTIVATED\n");
    if (ignoredCount > 0) {
      console.log(
        `Found ${files.length} file(s), processing ${filteredFiles.length} (${ignoredCount} ignored by ESLint config)\n`,
      );
    } else {
      console.log(
        `Processing ${filteredFiles.length} file(s) with comprehensive workflow...\n`,
      );
    }
  }

  let overallSuccess = true;
  const steps = [];
  let remarkIssues = [];
  let eslintIssues = [];

  // Step 1: Remark formatting (auto-fixes what it can)
  if (!quiet) console.log("Step 1/3: Running remark formatting...");
  try {
    const result = await processFiles(filteredFiles, {
      write: true,
      quiet: true,
    });
    const formatted = result.processedCount;
    const withIssues = result.hasErrors;

    steps.push({
      name: "Remark Format",
      success: formatted > 0,
      details: `Formatted ${formatted}/${result.totalFiles} files`,
    });

    if (!quiet) {
      console.log(`  ✓ Formatted ${formatted} file(s)`);
      if (withIssues) {
        console.log(`  ℹ️  Some issues require manual fixes\n`);
      } else {
        console.log();
      }
    }
  } catch (error) {
    steps.push({
      name: "Remark Format",
      success: false,
      details: error.message,
    });
    overallSuccess = false;
    if (!quiet) console.log(`  ✗ Remark formatting failed: ${error.message}\n`);
  }

  // Step 2: ESLint auto-fix (only if ESLint is available)
  if (hasEslint) {
    const eslintConfigInfo = await getEslintConfigPath();
    const { configPath, source } = eslintConfigInfo;

    if (!quiet)
      console.log("Step 2/3: Running ESLint auto-fix on code blocks...");
    try {
      const fileList = filteredFiles.map((f) => `"${f}"`).join(" ");
      const eslintCmd = `npx eslint --config "${configPath}" --fix ${fileList}`;

      try {
        const result = execSync(eslintCmd, {
          stdio: "pipe",
          cwd: process.cwd(),
        });
        steps.push({
          name: "ESLint Fix",
          success: true,
          details: "Fixed code blocks",
        });
        if (!quiet) console.log(`  ✓ ESLint auto-fix completed\n`);
      } catch (eslintError) {
        // ESLint returns non-zero if there are unfixable issues
        const output =
          eslintError.stdout?.toString() ||
          eslintError.stderr?.toString() ||
          "";

        // Filter out "File ignored" warnings - these are expected
        const lines = output
          .split("\n")
          .filter(
            (line) =>
              !line.includes(
                "File ignored because of a matching ignore pattern",
              ),
          );
        const filteredOutput = lines.join("\n");

        const hasWarnings = filteredOutput.includes("warning");
        const hasErrors = filteredOutput.includes("error");

        if (hasErrors || hasWarnings) {
          steps.push({
            name: "ESLint Fix",
            success: false,
            details: "Some issues remain",
          });
          if (!quiet)
            console.log(`  ⚠️  ESLint found issues that need manual fixes\n`);
        } else {
          steps.push({
            name: "ESLint Fix",
            success: true,
            details: "Fixed code blocks",
          });
          if (!quiet) console.log(`  ✓ ESLint auto-fix completed\n`);
        }
      }
    } catch (error) {
      steps.push({
        name: "ESLint Fix",
        success: false,
        details: error.message,
      });
      if (!quiet) console.log(`  ✗ ESLint auto-fix failed: ${error.message}\n`);
    }
  } else {
    if (!quiet) {
      console.log("Step 2/3: Skipping ESLint (not installed)");
      console.log(
        "  ℹ️  Install with: npm install -D eslint eslint-plugin-mdx\n",
      );
    }
    steps.push({
      name: "ESLint Fix",
      success: true,
      details: "Skipped (not installed)",
    });
  }

  // Step 3: Final validation
  if (!quiet) console.log("Step 3/3: Running final validation...");
  let validationResult;
  try {
    validationResult = await processFiles(filteredFiles, {
      lintOnly: true,
      quiet: true,
    });
    const hasIssues = validationResult.hasErrors;

    if (hasIssues) {
      overallSuccess = false;
    }

    steps.push({
      name: "Validation",
      success: !hasIssues,
      details: hasIssues ? "Issues found" : "All checks passed",
    });

    if (!quiet) {
      if (hasIssues) {
        console.log(`  ⚠️  Validation found remaining issues\n`);
      } else {
        console.log(`  ✓ All validation checks passed\n`);
      }
    }
  } catch (error) {
    steps.push({ name: "Validation", success: false, details: error.message });
    overallSuccess = false;
    if (!quiet) console.log(`  ✗ Validation failed: ${error.message}\n`);
  }

  // Show detailed issues if validation failed
  if (!quiet && validationResult?.hasErrors) {
    console.log("═".repeat(60));
    console.log("REMAINING ISSUES");
    console.log("═".repeat(60));
    await processFiles(filteredFiles, { lintOnly: true, quiet: false });
    console.log();
  }

  // Summary
  if (!quiet) {
    console.log("═".repeat(60));
    console.log("NUCLEAR MODE SUMMARY");
    console.log("═".repeat(60));
    steps.forEach((step) => {
      const icon = step.success ? "✓" : "⚠️";
      const status = step.success ? "PASS" : "NEEDS ATTENTION";
      console.log(
        `${icon} ${step.name.padEnd(20)} ${status.padEnd(16)} ${step.details}`,
      );
    });
    console.log("═".repeat(60));

    if (overallSuccess) {
      console.log("🎉 All checks passed! Your markdown is pristine.\n");
    } else {
      console.log("\n📋 NEXT STEPS:");
      console.log("   Review the issues above and fix them manually.");
      console.log("   Common fixes:");
      console.log("   • Shorten long lines (max 80 chars)");
      console.log(
        "   • Add language flags to code blocks (```js, ```bash, etc.)",
      );
      console.log(
        "   • Fix filename issues (use lowercase, avoid special chars)",
      );
      console.log("   • Add blank lines between list items\n");
    }
  }

  return { success: overallSuccess, steps };
}

/**
 * Check if ESLint is available in the project
 */
async function checkEslintAvailable() {
  try {
    execSync("npx eslint --version", { stdio: "pipe" });
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
  const localConfig = path.join(process.cwd(), "eslint.config.js");

  try {
    await fs.access(localConfig);
    // Local config exists - use it
    return { configPath: localConfig, source: "local" };
  } catch {
    // Use bundled config - dependencies are always available
    const bundledConfig = new URL("./eslint.config.js", import.meta.url)
      .pathname;
    return { configPath: bundledConfig, source: "bundled" };
  }
}

/**
 * Get ESLint ignore patterns from config
 * Returns array of ignore patterns to filter files in nuclear mode
 * Note: We parse the config file as text instead of importing it because
 * the config has dependencies that require ESLint to be in the require cache
 */
async function getEslintIgnorePatterns() {
  try {
    const { configPath } = await getEslintConfigPath();
    const configContent = await fs.readFile(configPath, "utf-8");

    // Extract the ignores array using regex
    // Look for: ignores: [ ... ]
    const ignoresMatch = configContent.match(/ignores:\s*\[([\s\S]*?)\]/);
    if (!ignoresMatch) return [];

    const ignoresContent = ignoresMatch[1];

    // Extract quoted strings from the array
    const patterns = [];
    const stringMatches = ignoresContent.matchAll(/['"]([^'"]+)['"]/g);
    for (const match of stringMatches) {
      patterns.push(match[1]);
    }

    return patterns;
  } catch (error) {
    return [];
  }
}

/**
 * Check if a file matches any of the ignore patterns
 */
function isFileIgnored(filePath, ignorePatterns) {
  // Convert ignore patterns to regex-like matching
  for (const pattern of ignorePatterns) {
    // Handle glob patterns
    if (pattern.includes("**")) {
      // **/*.config.js -> matches any .config.js file
      const regex = new RegExp(
        pattern
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, "__DOUBLESTAR__")
          .replace(/\*/g, "[^/]*")
          .replace(/__DOUBLESTAR__/g, ".*"),
      );
      if (regex.test(filePath)) return true;
    } else if (pattern.includes("*")) {
      // *.js -> matches .js files in root
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, "[^/]*").replace(/\./g, "\\.") + "$",
      );
      if (regex.test(filePath)) return true;
    } else {
      // Exact match or ends with pattern
      if (filePath === pattern || filePath.endsWith("/" + pattern)) return true;
    }
  }
  return false;
} /**
 * Initialize .remarkrc.js configuration
 */
async function initConfig() {
  const configPath = path.join(process.cwd(), ".remarkrc.js");

  try {
    await fs.access(configPath);
    console.log("⚠️  .remarkrc.js already exists");
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
  console.log("✓ Created .remarkrc.js configuration file");
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle version
  if (args.includes("--version") || args.includes("-v")) {
    const pkg = JSON.parse(
      await fs.readFile(new URL("./package.json", import.meta.url), "utf-8"),
    );
    console.log(pkg.version);
    return;
  }

  // Handle help
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Parse options
  const options = {
    quiet: commandArgs.includes("--quiet") || commandArgs.includes("-q"),
    nuclear: commandArgs.includes("--nuclear"),
    glob: null,
  };

  // Extract glob pattern
  const globIndex = commandArgs.findIndex((arg) => arg === "--glob");
  if (globIndex !== -1 && commandArgs[globIndex + 1]) {
    options.glob = commandArgs[globIndex + 1];
  }

  // Filter out option flags to get file arguments
  const fileArgs = commandArgs.filter(
    (arg) =>
      !arg.startsWith("--") && !arg.startsWith("-") && arg !== options.glob,
  );

  // Execute command
  switch (command) {
    case "format": {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log("No markdown files found");
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
      const result = await processFiles(files, {
        write: true,
        quiet: options.quiet,
      });
      if (!options.quiet) {
        console.log(
          `\n✓ Formatted ${result.processedCount} of ${result.totalFiles} files`,
        );
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case "check": {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log("No markdown files found");
        return;
      }
      if (!options.quiet) {
        console.log(`Checking ${files.length} file(s)...`);
      }
      const result = await processFiles(files, {
        write: false,
        quiet: options.quiet,
      });
      if (!options.quiet) {
        console.log(
          `\n${result.hasErrors ? "✗" : "✓"} Checked ${result.totalFiles} files`,
        );
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case "lint": {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log("No markdown files found");
        return;
      }
      if (!options.quiet) {
        console.log(`Linting ${files.length} file(s)...`);
      }
      const result = await processFiles(files, {
        lintOnly: true,
        quiet: options.quiet,
      });
      if (!options.quiet) {
        console.log(
          `\n${result.hasErrors ? "✗" : "✓"} Linted ${result.totalFiles} files`,
        );
      }
      process.exit(result.hasErrors ? 1 : 0);
      break;
    }

    case "init": {
      await initConfig();
      break;
    }

    case "setup": {
      // Import and run setup.js
      const setupPath = new URL("./setup.js", import.meta.url);
      await import(setupPath);
      break;
    }

    case "nuclear": {
      const files = await getFiles(fileArgs, options.glob);
      if (files.length === 0) {
        console.log("No markdown files found");
        return;
      }
      const result = await runNuclearMode(files, { quiet: options.quiet });
      process.exit(result.success ? 0 : 1);
      break;
    }

    case "autoformat": {
      // Parse autoformat-specific options
      const pluginsDir = commandArgs.includes("--plugins")
        ? commandArgs[commandArgs.indexOf("--plugins") + 1]
        : null;
      const recursive =
        commandArgs.includes("--recursive") || commandArgs.includes("-r");

      // Parse typography and formatting options
      const autoMode = commandArgs.includes("--auto");
      const semanticBreaks = autoMode || commandArgs.includes("--semantic");
      const smartQuotes = autoMode || commandArgs.includes("--smart-quotes");
      const ellipsis = autoMode || commandArgs.includes("--ellipsis");

      // Parse width option
      let wrapWidth = 88;
      const widthIndex = commandArgs.indexOf("--width");
      if (widthIndex !== -1 && commandArgs[widthIndex + 1]) {
        wrapWidth = parseInt(commandArgs[widthIndex + 1], 10);
      }

      // Get files to process
      let filesToProcess = [];
      if (options.glob) {
        filesToProcess = await glob(options.glob, {
          ignore: ["node_modules/**", ".git/**"],
        });
      } else if (fileArgs.length > 0) {
        // Check if arguments are files or directories
        for (const arg of fileArgs) {
          try {
            const stat = await fs.stat(arg);
            if (stat.isDirectory()) {
              if (recursive) {
                const pattern = path.join(arg, "**/*.{txt,md,mdx,mdc,mdd}");
                const dirFiles = await glob(pattern, {
                  ignore: ["node_modules/**", ".git/**"],
                });
                filesToProcess.push(...dirFiles);
              } else {
                console.error(
                  `Error: ${arg} is a directory. Use --recursive to process directories.`,
                );
                process.exit(1);
              }
            } else {
              filesToProcess.push(arg);
            }
          } catch (error) {
            console.error(`Error: Cannot access ${arg}`);
            process.exit(1);
          }
        }
      } else {
        // Default: find all text and markdown files
        filesToProcess = await glob("**/*.{txt,md,mdx,mdc,mdd}", {
          ignore: ["node_modules/**", ".git/**"],
        });
      }

      if (filesToProcess.length === 0) {
        console.log("No files found to auto-format");
        return;
      }

      if (!options.quiet) {
        console.log(`\n🤖 AUTO-FORMAT MODE\n`);
        console.log(`Processing ${filesToProcess.length} file(s)...\n`);
      }

      // Initialize auto-formatter with options
      const formatter = new AutoFormatter({
        aggressive: true,
        semanticBreaks,
        smartQuotes,
        ellipsis,
        wrapWidth,
      });

      // Load plugins if specified
      if (pluginsDir) {
        try {
          await formatter.loadPlugins(pluginsDir);
          if (!options.quiet) {
            console.log(`✓ Loaded plugins from ${pluginsDir}\n`);
          }
        } catch (error) {
          console.error(
            `⚠️  Could not load plugins from ${pluginsDir}:`,
            error.message,
          );
        }
      }

      // Format files
      const results = await formatter.formatFiles(filesToProcess, {
        write: true,
        quiet: options.quiet,
      });

      // Summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (!options.quiet) {
        console.log(`\n${"═".repeat(60)}`);
        console.log("AUTO-FORMAT SUMMARY");
        console.log("═".repeat(60));
        console.log(`✓ Successfully formatted: ${successful} file(s)`);
        if (failed > 0) {
          console.log(`✗ Failed: ${failed} file(s)`);
        }
        console.log("═".repeat(60));
        console.log();
      }

      process.exit(failed > 0 ? 1 : 0);
      break;
    }

    case "draft": {
      // Parse draft-specific options
      const dryRun = commandArgs.includes("--dry-run");
      const polish = commandArgs.includes("--polish");
      const recursive =
        commandArgs.includes("--recursive") || commandArgs.includes("-r");

      // Parse header level option
      let headerLevel = 3;
      const headerLevelIndex = commandArgs.indexOf("--header-level");
      if (headerLevelIndex !== -1 && commandArgs[headerLevelIndex + 1]) {
        headerLevel = parseInt(commandArgs[headerLevelIndex + 1], 10);
      }

      // Get files to process
      let filesToProcess = [];
      if (options.glob) {
        filesToProcess = await glob(options.glob, {
          ignore: ["node_modules/**", ".git/**"],
        });
      } else if (fileArgs.length > 0) {
        for (const arg of fileArgs) {
          try {
            const stat = await fs.stat(arg);
            if (stat.isDirectory()) {
              if (recursive) {
                const pattern = path.join(arg, "**/*.{txt,md,mdx,mdc,mdd}");
                const dirFiles = await glob(pattern, {
                  ignore: ["node_modules/**", ".git/**"],
                });
                filesToProcess.push(...dirFiles);
              } else {
                console.error(
                  `Error: ${arg} is a directory. Use --recursive to process directories.`,
                );
                process.exit(1);
              }
            } else {
              filesToProcess.push(arg);
            }
          } catch (error) {
            console.error(`Error: Cannot access ${arg}`);
            process.exit(1);
          }
        }
      } else {
        // Default: find all text and markdown files
        filesToProcess = await glob("**/*.{txt,md,mdx,mdc,mdd}", {
          ignore: ["node_modules/**", ".git/**"],
        });
      }

      if (filesToProcess.length === 0) {
        console.log("No files found to process");
        return;
      }

      if (!options.quiet) {
        console.log(`\n📝 DRAFT MODE\n`);
        console.log(
          `Processing ${filesToProcess.length} file(s) with aggressive structure detection...\n`,
        );
      }

      // Initialize auto-formatter with draft mode enabled
      const formatter = new AutoFormatter({
        aggressive: true,
        roughDraft: true,
        headerLevel,
      });

      let results;
      if (dryRun) {
        // Preview mode - show output without writing
        for (const filePath of filesToProcess) {
          try {
            const content = await fs.readFile(filePath, "utf-8");
            // Use async format for full NLP processing
            const formatted = await formatter.formatAsync(content);

            // Optionally run through remark pipeline
            let finalContent = formatted;
            if (polish) {
              const result = await processFiles([filePath], {
                write: false,
                quiet: true,
                lintOnly: false,
              });
              // For dry-run with polish, we'd need to process the formatted content
              // This is a simplified version - full polish would need more work
            }

            console.log(`\n${"═".repeat(60)}`);
            console.log(`File: ${filePath}`);
            console.log("═".repeat(60));
            console.log(finalContent);
          } catch (error) {
            console.error(`✗ Error processing ${filePath}:`, error.message);
          }
        }
        return;
      }

      // Write mode
      results = await formatter.formatFiles(filesToProcess, {
        write: true,
        quiet: options.quiet,
      });

      // If polish is enabled, run remark on the formatted files
      if (polish) {
        if (!options.quiet) {
          console.log(`\n🔧 Running remark polish on draft output...\n`);
        }
        await processFiles(filesToProcess, {
          write: true,
          quiet: options.quiet,
        });
      }

      // Summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (!options.quiet) {
        console.log(`\n${"═".repeat(60)}`);
        console.log("DRAFT MODE SUMMARY");
        console.log("═".repeat(60));
        console.log(`✓ Successfully transformed: ${successful} file(s)`);
        if (failed > 0) {
          console.log(`✗ Failed: ${failed} file(s)`);
        }
        if (polish) {
          console.log(`✓ Remark polish applied`);
        }
        console.log("═".repeat(60));
        console.log();
      }

      process.exit(failed > 0 ? 1 : 0);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "markdownkit --help" for usage information');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
