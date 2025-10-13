# Markdown Formatter (markdownfix)

**Opinionated markdown formatter and linter for `.md`, `.mdd`, and `.mdx` files**

Built on the Remark ecosystem with strict, consistent formatting rules for developer documentation, technical writing, and web content. Perfect for README files, technical docs, blogs, and GitHub wikis.

## Features

- ✅ **Opinionated formatting** - Consistent style across all markdown files
- ✅ **GitHub Flavored Markdown** - Tables, task lists, strikethrough, autolinks
- ✅ **MDX support** - JSX components in markdown
- ✅ **Comprehensive linting** - 40+ lint rules for quality and consistency
- ✅ **Link validation** - Check for broken links
- ✅ **Auto-fixing** - Automatically fix formatting issues

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
    "lint:md": "markdownfix lint"
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

| Extension | Support | Features | Use Case |
|-----------|---------|----------|----------|
| `.md` | ✅ Full | GFM, frontmatter, tables, task lists | Documentation, READMEs, blogs |
| `.mdx` | ✅ Full | Above + JSX components, imports/exports | React docs, interactive content |
| `.mdd` | ⚠️ Optional | Business documents (see below) | Invoices, proposals, contracts |

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
markdownfix init               # Create .remarkrc.js config
markdownfix setup              # Create example content structure
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
pnpm run lint           # Check compliance

# Combined
pnpm run process        # Format then lint
pnpm run process:safe   # Dry-run first, then process
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

## Two Projects, One Ecosystem

This repository focuses on **developer documentation** (READMEs, technical docs, blogs).

For **business documents** (invoices, proposals, letters, contracts), we have a companion project:

### 📄 [MDD (Markdown Document)](https://github.com/entro314-labs/mdd)

MDD extends markdown with business-focused features:

- Letterheads and headers/footers
- Signature blocks
- Contact information blocks
- Professional PDF/DOCX output
- Invoice and proposal templates

```bash
# Quick example
cd ../mdd
pnpm run preview examples/invoice.mdd
# Opens professional HTML invoice in browser
```

**When to use which:**

| Use Case | Project | File Type |
|----------|---------|-----------|
| README files | Markdown Formatter | `.md` |
| Technical docs | Markdown Formatter | `.md` |
| Blog posts | Markdown Formatter | `.md` / `.mdx` |
| React documentation | Markdown Formatter | `.mdx` |
| **Business letters** | **MDD** | `.mdd` |
| **Invoices** | **MDD** | `.mdd` |
| **Proposals** | **MDD** | `.mdd` |
| **Contracts** | **MDD** | `.mdd` |

## Documentation

- **[content/guides/style-guide.md](content/guides/style-guide.md)** - Style specifications

## Tech Stack

- **Remark** - Markdown processor
- **Unified** - AST transformation
- **GFM** - GitHub Flavored Markdown
- **MDX** - JSX in markdown

## Contributing

This is an opinionated formatter with specific style decisions. Contributions should:
- Maintain existing formatting rules
- Add value for developer documentation
- Not break existing lint rules
- Include test cases

## License

MIT
