# Markdown Formatter (markdownkit)

**Opinionated markdown formatter and linter for `.md`, `.mdx`, `.mdc`, and `.mdd` files**

Built on the Remark ecosystem with strict, consistent formatting rules for developer documentation, technical writing, and web content. Perfect for README files, technical docs, blogs, and GitHub wikis.

## Features

- ✅ **Opinionated formatting** - Consistent style across all markdown files
- ✅ **GitHub Flavored Markdown** - Tables, task lists, strikethrough, autolinks
- ✅ **MDX support** - JSX components in markdown with ESLint integration
- ✅ **MDC syntax support** - Markdown Components for Nuxt Content
- ✅ **Comprehensive linting** - 40+ remark-lint rules for quality and consistency
- ✅ **Code block linting** - ESLint integration built-in for JavaScript/JSX in code blocks
- ✅ **Link validation** - Check for broken links
- ✅ **Auto-fixing** - Automatically fix formatting issues
- ✅ **Zero config** - Works out of the box, customize if needed
- ✅ **IDE integration** - Works with VS Code ESLint extension

## Installation

```bash
# Install globally
npm install -g markdownkit

# Or use with npx (no installation)
npx markdownkit --help
```

## Quick Start

```bash
# Format all markdown files in current directory
markdownkit format

# Check formatting without writing changes
markdownkit check

# Lint files for issues
markdownkit lint

# 🚀 Nuclear mode - run ALL linters and fixers
markdownkit nuclear

# Format specific files
markdownkit format README.md docs/*.md

# Use glob patterns
markdownkit format --glob "src/**/*.md"

# Quiet mode (suppress output)
markdownkit format --quiet
```

### Using as a Package Script

Add to your `package.json`:

```json
{
  "scripts": {
    "format:md": "markdownkit format",
    "lint:md": "markdownkit lint",
    "fix:md": "markdownkit nuclear"
  }
}
```

### Initialize Project

```bash
# Create .remarkrc.js configuration
markdownkit init

# Create example content structure
markdownkit setup
```

## What Gets Formatted

### Lists

- **Unordered**: `-` (never `*` or `+`)
- **Ordered**: `1.` incremental (never `1)`)

### Emphasis

- **Italic**: `_text_` (underscore, not asterisk)
- **Bold**: `**text**` (double asterisk, not underscore)

### Headings

- **Style**: ATX (`# Title`), never setext (`===`)
- **Hierarchy**: Must progress sequentially (no skipping levels)

### Code Blocks

- Always fenced (` ``` `) with language identifiers
- Never indented code blocks

### Formatting

- **Line length**: 100 characters max with smart wrapping
- **Tables**: Padded cells with aligned pipes (auto-formatted)
- **Final newline**: All files must end with `\n`
- **No trailing spaces**: Automatically removed

## File Support

| Extension | Support     | Features                                | Use Case                        |
| --------- | ----------- | --------------------------------------- | ------------------------------- |
| `.md`     | ✅ Full     | GFM, frontmatter, tables, task lists    | Documentation, READMEs, blogs   |
| `.mdx`    | ✅ Full     | Above + JSX components, imports/exports | React docs, interactive content |
| `.mdc`    | ✅ Full     | Markdown Components (Nuxt Content)      | Nuxt Content, Vue documentation |
| `.mdd`    | ⚠️ Optional | Business documents (see below)          | Invoices, proposals, contracts  |

### MDC Support

This formatter includes **full support for `.mdc` files** and MDC (Markdown Components) syntax via `remark-mdc`. MDC is a superset of Markdown developed by Nuxt that allows you to use Vue-like components.

**MDC Features:**

```markdown
<!-- Block components -->

::card
This is card content with **formatting**.
::

<!-- Inline components -->

This is text with an :icon{name="rocket"} inline component.

<!-- Props and attributes -->

![Image]{.rounded width="400"}

<!-- Slots and nesting -->

::alert{type="warning"}
This is a warning message!
::
```

**Perfect for:**

- Nuxt Content projects
- Component-driven documentation
- Interactive markdown content
- Vue.js documentation sites

**File Usage:**

- `.mdc` extension - Dedicated MDC files (like `.mdx` for JSX)
- MDC syntax also works in `.md` and `.mdx` files

### MDD Support

This formatter can **optionally** format `.mdd` files if you install the [MDD package](https://www.npmjs.com/package/@markdownkit/mdd):

```bash
# Install MDD support
pnpm add @markdownkit/mdd

# Now .mdd files will be formatted
pnpm run format
```

**Note**: MDD is a separate project for business documents. See the [MDD project](https://github.com/entro314-labs/mdd) for details.

## CLI Commands

### Available Commands

```bash
markdownkit format [files...]     # Format and fix markdown files
markdownkit check [files...]      # Check without writing changes
markdownkit lint [files...]       # Lint for issues only
markdownkit nuclear [files...]    # 🚀 Run ALL linters and fixers
markdownkit autoformat [files...] # 🤖 Convert plain text to markdown
markdownkit draft [files...]      # 📝 NLP-enhanced rough text transformer
markdownkit init                  # Create .remarkrc.js config
markdownkit setup                 # Create example content structure
```

### 🚀 Nuclear Mode

The `nuclear` command runs a comprehensive 3-step workflow that applies **all** available linters and fixers:

1. **Remark Formatting** - Auto-fix markdown syntax
2. **ESLint Auto-fix** - Fix JavaScript/JSX in code blocks
3. **Final Validation** - Report any remaining issues

**Perfect for:**

- Pre-commit hooks
- CI/CD pipelines
- Major cleanup sessions
- Ensuring everything is pristine

**Usage:**

```bash
# Run on all markdown files
markdownkit nuclear

# Run on specific directory
markdownkit nuclear --glob "docs/**/*.{md,mdx}"

# Add to package.json
{
  "scripts": {
    "precommit": "markdownkit nuclear"
  }
}
```

**Example Output (Success):**

```
🚀 NUCLEAR MODE ACTIVATED

Processing 15 file(s) with comprehensive workflow...

Step 1/3: Running remark formatting...
  ✓ Formatted 15 file(s)

Step 2/3: Running ESLint auto-fix on code blocks...
  ✓ ESLint auto-fix completed

Step 3/3: Running final validation...
  ✓ All validation checks passed

════════════════════════════════════════════════════════════
NUCLEAR MODE SUMMARY
════════════════════════════════════════════════════════════
✓ Remark Format        PASS             Formatted 15/15 files
✓ ESLint Fix           PASS             Fixed code blocks
✓ Validation           PASS             All checks passed
════════════════════════════════════════════════════════════
🎉 All checks passed! Your markdown is pristine.
```

**Example Output (Issues Found):**

````
🚀 NUCLEAR MODE ACTIVATED

Processing 8 file(s) with comprehensive workflow...

Step 1/3: Running remark formatting...
  ✓ Formatted 8 file(s)
  ℹ️  Some issues require manual fixes

Step 2/3: Running ESLint auto-fix on code blocks...
  ⚠️  ESLint found issues that need manual fixes

Step 3/3: Running final validation...
  ⚠️  Validation found remaining issues

════════════════════════════════════════════════════════════
REMAINING ISSUES
════════════════════════════════════════════════════════════
file.md
  3:128  error  Line too long (max 80 chars)
  17:1   error  Missing code block language flag

════════════════════════════════════════════════════════════
NUCLEAR MODE SUMMARY
════════════════════════════════════════════════════════════
✓ Remark Format        PASS             Formatted 8/8 files
⚠️ ESLint Fix           NEEDS ATTENTION  Some issues remain
⚠️ Validation           NEEDS ATTENTION  Issues found
════════════════════════════════════════════════════════════

📋 NEXT STEPS:
   Review the issues above and fix them manually.
   Common fixes:
   • Shorten long lines (max 80 chars)
   • Add language flags to code blocks (```js, ```bash, etc.)
   • Fix filename issues (use lowercase, avoid special chars)
   • Add blank lines between list items
````

### 🤖 Autoformat Mode

The `autoformat` command converts plain text with minimal structure into proper markdown:

```bash
# Convert files to structured markdown
markdownkit autoformat notes.txt

# Enable smart typography (quotes, dashes, ellipsis)
markdownkit autoformat --auto document.md

# Load custom formatting plugins
markdownkit autoformat --plugins ./my-plugins file.txt
```

**Options:** `--semantic`, `--smart-quotes`, `--ellipsis`, `--width <n>`, `--auto`, `--plugins <dir>`

### 📝 Draft Mode (NLP-Enhanced)

The `draft` command uses **retext NLP** for intelligent text processing of rough notes:

```bash
# Transform rough text with NLP processing
markdownkit draft notes.txt

# Preview output without writing
markdownkit draft --dry-run messy.txt

# Use H2 for folder headers (default: H3)
markdownkit draft --header-level 2 file.txt
```

**NLP Transformations:**

- `i think` → `I think` (pronoun fix)
- `"hello"` → `"hello"` (smart quotes)
- `...` → `…` (ellipsis)
- `project-name/` → `### Project Name` (folder headers)

### Command Aliases

The CLI is available via two commands:

- `markdownkit` (full name)
- `mdkit` (short alias)

```bash
# These are equivalent
markdownkit format
mdkit format
```

### Options

```bash
--help, -h         Show help message
--version, -v      Show version number
--quiet, -q        Suppress output except errors
--glob <pattern>   Use glob pattern for file matching
```

### Examples

```bash
# Format all markdown in project
mdkit format

# Check specific files
mdkit check README.md CHANGELOG.md

# Lint with glob pattern
mdkit lint --glob "docs/**/*.{md,mdx}"

# Quiet formatting
mdkit format --quiet

# Get help
mdkit --help
```

## Development Scripts

If you're working on the markdownkit project itself:

```bash
# Formatting
pnpm run format         # Apply fixes using remark-cli
pnpm run format:check   # Preview changes

# Linting
pnpm run lint           # Remark-lint only
pnpm run lint:eslint    # ESLint + MDX only
pnpm run lint:eslint:fix # ESLint auto-fix
pnpm run lint:all       # Both remark and ESLint

# Combined
pnpm run process        # Format then lint all
pnpm run process:safe   # Dry-run first, then lint all
pnpm run nuclear        # 🚀 Run ALL linters and fixers
pnpm test               # Same as process:safe

# Utilities
pnpm run check-links    # Validate all markdown links
pnpm run clean-cache    # Clear remark cache
```

## Project Structure

```
markdownkit/
├── content/            # Example content
│   ├── docs/
│   ├── blog/
│   └── guides/
├── .remarkrc.js        # Formatting & linting rules
├── .remarkignore       # Files to exclude
├── setup.js            # Bootstrap script
├── package.json
└── README.md
```

## Configuration

### `.remarkrc.js`

Central configuration defining:

- All formatting rules
- Plugin chain order
- Lint rule settings

**Plugin order is critical:**

1. `remark-frontmatter` - Parse YAML/TOML
2. `remark-gfm` - GitHub Flavored Markdown
3. `remark-mdx` - MDX support (conditional)
4. Lint presets + rules
5. `remark-stringify` - Must be last

### `eslint.config.js` (Optional)

ESLint is **built-in** with opinionated defaults. Customize by creating `eslint.config.js` in your project:

**Default Behavior:**

- ✅ ESLint and eslint-plugin-mdx are included in the package
- ✅ Automatically uses bundled config if no local config found
- ✅ Lints JavaScript/JSX in code blocks
- ✅ Works out of the box globally or locally

**Custom Configuration:**

Create `eslint.config.js` in your project to override defaults:

```javascript
import * as mdxPlugin from "eslint-plugin-mdx";

export default [
  {
    files: ["**/*.{md,mdx,mdc,mdd}"],
    ...mdxPlugin.flat,
    // Your custom rules here
  },
];
```

See [ESLINT_INTEGRATION.md](ESLINT_INTEGRATION.md) for full details.

### `.remarkignore`

Files excluded from processing:

- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `node_modules/`
- `pnpm-lock.yaml`

## Frontmatter Convention

```yaml
---
title: Required for all content files
date: YYYY-MM-DD format preferred
author: Optional but recommended
---
```

## Common Issues

### "No input" Errors

**Cause**: No markdown files found or all files excluded

**Solution**:

- Ensure markdown files exist in `content/` directory
- Check `.remarkignore` patterns
- Verify correct file extensions (`.md`, `.mdx`)

### Linting Failures After Formatting

**Cause**: Some rules require manual fixes (duplicate headings, broken links)

**Solution**:

- Read console output for specific violations
- Manually fix reported issues
- Use `pnpm run format:check` to separate formatting from lint errors

### MDX Parsing Errors

**Cause**: Invalid JSX syntax

**Solution**:

- Verify JSX is valid JavaScript
- Check all tags are properly closed
- Ensure React components use `<Component />` not `<Component>`

## Bootstrap New Project

```bash
# Create example content structure
node setup.js

# Install dependencies
pnpm install

# Verify everything works
pnpm run process:safe
```

## Editor Integration

**Disable VS Code remark extensions** - they may conflict with this opinionated configuration. Always use command line processing.

## Entro314 Labs Markdown Ecosystem

markdownkit is part of a comprehensive markdown ecosystem. For complete documentation, see [PROJECT_ECOSYSTEM.md](../PROJECT_ECOSYSTEM.md).

### Companion Projects

#### 📄 [MDD (Markdown Document)](https://github.com/entro314-labs/mdd)

**The missing document layer for the AI-to-Office pipeline.**

Semantic document format for professional business documents:

- **Semantic directives**: `::letterhead`, `::signature-block`, `::header`, `::footer`
- **Multi-format output**: HTML, PDF, DOCX from single source
- **AI workflow integration**: ChatGPT/Claude markdown → professional documents
- **Zero configuration**: Professional styling built-in
- **200+ document types**: Comprehensive business document catalog
- **Version control friendly**: Plain text `.mdd` files

**Installation**: `npm install -g @markdownkit/mdd`

**Quick start**:

```bash
# Preview business document
mdd-preview document.mdd

# Or use with npx
npx mdd-preview examples/invoice.mdd
```

markdownkit can **optionally format `.mdd` files** by installing MDD as a dependency.

#### 🖥️ [Anasa](https://github.com/entro314-labs/anasa)

Desktop knowledge management application with MDD integration:

- Bidirectional linking and graph visualization
- TipTap WYSIWYG editor
- **First GUI editor for MDD format**
- Create professional business documents inside your knowledge base
- Live preview and PDF export

**Status**: MDD integration planned ([see integration spec](../anasa/MDD_INTEGRATION_SPEC.md))

### When to Use Which

| Document Type                  | Use         | File Extension | Package                    |
| ------------------------------ | ----------- | -------------- | -------------------------- |
| README files                   | markdownkit | `.md`          | `@markdownkit/markdownkit` |
| Technical documentation        | markdownkit | `.md`          | `@markdownkit/markdownkit` |
| Blog posts                     | markdownkit | `.md` / `.mdx` | `@markdownkit/markdownkit` |
| React component docs           | markdownkit | `.mdx`         | `@markdownkit/markdownkit` |
| **Business letters**           | **MDD**     | **`.mdd`**     | **`@markdownkit/mdd`**     |
| **Invoices**                   | **MDD**     | **`.mdd`**     | **`@markdownkit/mdd`**     |
| **Proposals**                  | **MDD**     | **`.mdd`**     | **`@markdownkit/mdd`**     |
| **Contracts**                  | **MDD**     | **`.mdd`**     | **`@markdownkit/mdd`**     |
| Knowledge base + business docs | Anasa + MDD | `.md` + `.mdd` | Desktop app                |

## Documentation

- **[content/guides/style-guide.md](content/guides/style-guide.md)** - Style specifications
- **[ESLINT_INTEGRATION.md](ESLINT_INTEGRATION.md)** - ESLint + MDX integration guide

## Tech Stack

- **Remark** - Markdown processor
- **Unified** - AST transformation
- **Retext** - Natural language processing (NLP)
- **GFM** - GitHub Flavored Markdown
- **MDX** - JSX in markdown
- **MDC** - Markdown Components (Nuxt Content)
- **ESLint** - JavaScript/JSX linting in code blocks

## Contributing

This is an opinionated formatter with specific style decisions. Contributions should:

- Maintain existing formatting rules
- Add value for developer documentation
- Not break existing lint rules
- Include test cases

## License

MIT
