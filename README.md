# Markdown Formatter (markdownfix)

**Opinionated markdown formatter and linter for `.md`, `.mdx`, `.mdc`, and `.mdd` files**

Built on the Remark ecosystem with strict, consistent formatting rules for developer documentation, technical writing, and web content. Perfect for README files, technical docs, blogs, and GitHub wikis.

## Features

- ✅ **Opinionated formatting** - Consistent style across all markdown files
- ✅ **GitHub Flavored Markdown** - Tables, task lists, strikethrough, autolinks
- ✅ **MDX support** - JSX components in markdown with ESLint integration
- ✅ **MDC syntax support** - Markdown Components for Nuxt Content
- ✅ **Comprehensive linting** - 40+ remark-lint rules for quality and consistency
- ✅ **Code block linting** - ESLint integration for JavaScript/JSX in code blocks
- ✅ **Link validation** - Check for broken links
- ✅ **Auto-fixing** - Automatically fix formatting issues
- ✅ **IDE integration** - Works with VS Code ESLint extension

## Installation

```bash
# Install globally
npm install -g markdownfix

# Or use with npx (no installation)
npx markdownfix --help
```

## Quick Start

```bash
# Format all markdown files in current directory
markdownfix format

# Check formatting without writing changes
markdownfix check

# Lint files for issues
markdownfix lint

# 🚀 Nuclear mode - run ALL linters and fixers
markdownfix nuclear

# Format specific files
markdownfix format README.md docs/*.md

# Use glob patterns
markdownfix format --glob "src/**/*.md"

# Quiet mode (suppress output)
markdownfix format --quiet
```

### Using as a Package Script

Add to your `package.json`:

```json
{
  "scripts": {
    "format:md": "markdownfix format",
    "lint:md": "markdownfix lint",
    "fix:md": "markdownfix nuclear"
  }
}
```

### Initialize Project

```bash
# Create .remarkrc.js configuration
markdownfix init

# Create example content structure
markdownfix setup
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
| `.md`     | ✅ Full      | GFM, frontmatter, tables, task lists    | Documentation, READMEs, blogs   |
| `.mdx`    | ✅ Full      | Above + JSX components, imports/exports | React docs, interactive content |
| `.mdc`    | ✅ Full      | Markdown Components (Nuxt Content)      | Nuxt Content, Vue documentation |
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

This formatter can **optionally** format `.mdd` files if you install the [MDD package](https://www.npmjs.com/package/@entro314labs/mdd):

```bash
# Install MDD support
pnpm add @entro314labs/mdd

# Now .mdd files will be formatted
pnpm run format
```

**Note**: MDD is a separate project for business documents. See the [MDD project](https://github.com/entro314-labs/mdd) for details.

## CLI Commands

### Available Commands

```bash
markdownfix format [files...]   # Format and fix markdown files
markdownfix check [files...]    # Check without writing changes
markdownfix lint [files...]     # Lint for issues only
markdownfix nuclear [files...]  # 🚀 Run ALL linters and fixers
markdownfix init               # Create .remarkrc.js config
markdownfix setup              # Create example content structure
```

### 🚀 Nuclear Mode

The `nuclear` command runs a comprehensive 4-step workflow that applies **all** available linters and fixers:

1. **Remark Formatting** - Auto-fix markdown syntax
2. **Remark Linting** - Validate markdown rules (40+ rules)
3. **ESLint Auto-fix** - Fix JavaScript/JSX in code blocks
4. **ESLint Linting** - Validate code quality

**Perfect for:**

- Pre-commit hooks
- CI/CD pipelines
- Major cleanup sessions
- Ensuring everything is pristine

**Usage:**

```bash
# Run on all markdown files
markdownfix nuclear

# Run on specific directory
markdownfix nuclear --glob "docs/**/*.{md,mdx}"

# Add to package.json
{
  "scripts": {
    "precommit": "markdownfix nuclear"
  }
}
```

**Example Output:**

```
🚀 NUCLEAR MODE ACTIVATED

Processing 15 file(s) with comprehensive workflow...

Step 1/4: Running remark formatting...
  ✓ Remark formatting completed

Step 2/4: Running remark linting...
  ✓ Remark linting passed

Step 3/4: Running ESLint auto-fix...
  ✓ ESLint auto-fix completed

Step 4/4: Running ESLint linting...
  ✓ ESLint linting passed

════════════════════════════════════════════════════════════
NUCLEAR MODE SUMMARY
════════════════════════════════════════════════════════════
✓ Remark Format        PASS   Formatted 15/15 files
✓ Remark Lint          PASS   Linted 15 files
✓ ESLint Fix           PASS   Auto-fixed code blocks
✓ ESLint Lint          PASS   All code blocks valid
════════════════════════════════════════════════════════════
🎉 All checks passed! Your markdown is pristine.
```

### Command Aliases

The CLI is available via two commands:

- `markdownfix` (full name)
- `mdfix` (short alias)

```bash
# These are equivalent
markdownfix format
mdfix format
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
mdfix format

# Check specific files
mdfix check README.md CHANGELOG.md

# Lint with glob pattern
mdfix lint --glob "docs/**/*.{md,mdx}"

# Quiet formatting
mdfix format --quiet

# Get help
mdfix --help
```

## Development Scripts

If you're working on the markdownfix project itself:

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
markdownfix/
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

When using ESLint integration for MDX/code blocks:

**Global Installation Behavior:**

- ✅ Uses your local `eslint.config.js` if it exists
- ✅ Falls back to bundled config if not found
- ℹ️ Shows message: "Using bundled ESLint config"

**Custom Configuration:**

Create `eslint.config.js` in your project to override defaults:

```javascript
import * as mdxPlugin from 'eslint-plugin-mdx';

export default [
  {
    files: ['**/*.{md,mdx,mdc,mdd}'],
    ...mdxPlugin.flat,
    // Your custom rules here
  }
];
```

See [ESLINT\_INTEGRATION.md](ESLINT_INTEGRATION.md) for full details.

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

markdownfix is part of a comprehensive markdown ecosystem. For complete documentation, see [PROJECT\_ECOSYSTEM.md](../PROJECT_ECOSYSTEM.md).

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

**Installation**: `npm install -g @entro314labs/mdd`

**Quick start**:

```bash
# Preview business document
mdd-preview document.mdd

# Or use with npx
npx mdd-preview examples/invoice.mdd
```

markdownfix can **optionally format `.mdd` files** by installing MDD as a dependency.

#### 🖥️ [Anasa](https://github.com/entro314-labs/anasa)

Desktop knowledge management application with MDD integration:

- Bidirectional linking and graph visualization
- TipTap WYSIWYG editor
- **First GUI editor for MDD format**
- Create professional business documents inside your knowledge base
- Live preview and PDF export

**Status**: MDD integration planned ([see integration spec](../anasa/MDD_INTEGRATION_SPEC.md))

### When to Use Which

| Document Type                  | Use         | File Extension | Package                     |
| ------------------------------ | ----------- | -------------- | --------------------------- |
| README files                   | markdownfix | `.md`          | `@entro314labs/markdownfix` |
| Technical documentation        | markdownfix | `.md`          | `@entro314labs/markdownfix` |
| Blog posts                     | markdownfix | `.md` / `.mdx` | `@entro314labs/markdownfix` |
| React component docs           | markdownfix | `.mdx`         | `@entro314labs/markdownfix` |
| **Business letters**           | **MDD**     | **`.mdd`**     | **`@entro314labs/mdd`**     |
| **Invoices**                   | **MDD**     | **`.mdd`**     | **`@entro314labs/mdd`**     |
| **Proposals**                  | **MDD**     | **`.mdd`**     | **`@entro314labs/mdd`**     |
| **Contracts**                  | **MDD**     | **`.mdd`**     | **`@entro314labs/mdd`**     |
| Knowledge base + business docs | Anasa + MDD | `.md` + `.mdd` | Desktop app                 |

## Documentation

- **[content/guides/style-guide.md](content/guides/style-guide.md)** - Style specifications
- **[ESLINT\_INTEGRATION.md](ESLINT_INTEGRATION.md)** - ESLint + MDX integration guide

## Tech Stack

- **Remark** - Markdown processor
- **Unified** - AST transformation
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
