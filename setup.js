#!/usr/bin/env node

/**
 * Setup script for markdown processor project
 * Creates necessary directories and example files
 */

import fs from 'fs/promises'
import path from 'path'

const EXAMPLE_FILES = {
  'content/docs/getting-started.md': `---
title: Getting Started Guide
date: 2024-01-15
author: Team
---

# Getting Started Guide

This is an example markdown file that will be processed by our formatter.

## Installation

1. Clone the repository
2. Run \`npm install\`
3. Start formatting your files

### Prerequisites

Before you begin, make sure you have:

* Node.js 16 or higher
* npm or yarn package manager

## Usage

The formatter supports various commands:

- \`npm run lint\` - Check for issues
- \`npm run format\` - Fix formatting  
- \`npm run process\` - Complete processing

**Note**: Always backup your files before processing.

> **Warning**: Some changes cannot be automatically fixed and require manual review.

For more details, see the [API Reference](./api-reference.md).
`,

  'content/docs/api-reference.md': `---
title: API Reference  
date: 2024-01-20
---

# API Reference

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`bullet\` | string | \`-\` | Unordered list marker |
| \`emphasis\` | string | \`_\` | Emphasis marker |
| \`strong\` | string | \`*\` | Strong marker |

## Available Scripts

### npm run lint

Checks all markdown files for style violations.

\`\`\`bash
npm run lint
\`\`\`

### npm run format  

Automatically fixes formatting issues.

\`\`\`bash
npm run format
\`\`\`

## Custom Rules

You can add custom rules in \`.remarkrc.js\`:

\`\`\`javascript
['remark-lint-maximum-line-length', 80]
\`\`\`
`,

  'content/blog/index.md': `# Blog Posts

Welcome to our blog! Here are our latest posts:

## Recent Posts

- [Markdown Tips and Tricks](./2024-01-15-markdown-tips.md)
- [MDX Features Overview](./2024-02-01-mdx-features.mdx)

## Archive

Browse all posts by date or category.
`,

  'content/guides/style-guide.md': `---
title: Markdown Style Guide
---

# Markdown Style Guide  

This document defines the formatting standards enforced by this project.

## Headings

- Use ATX-style headings (\`#\` syntax)
- Don't skip heading levels
- Add blank lines before and after headings

### Good Example

\`\`\`markdown
# Main Heading

## Section Heading  

### Subsection Heading
\`\`\`

### Bad Example  

\`\`\`markdown
#Main Heading
####Skipped Levels
\`\`\`

## Lists

### Unordered Lists

Use hyphens (\`-\`) for unordered lists:

\`\`\`markdown
- First item
- Second item
  - Nested item
  - Another nested item
\`\`\`

### Ordered Lists

Use periods (\`.\`) for ordered lists:

\`\`\`markdown
1. First step
2. Second step
3. Third step
\`\`\`

## Emphasis

- Use \`_underscores_\` for _emphasis_
- Use \`**asterisks**\` for **strong emphasis**

## Code

### Inline Code

Use \`backticks\` for inline code.

### Code Blocks

Always use fenced code blocks with language identifiers:

\`\`\`javascript
function example() {
  return "Hello World"
}
\`\`\`

## Links

- Use descriptive link text
- Include link titles when helpful: [Example](https://example.com "Example Website")

## Images

Always include descriptive alt text:

\`\`\`markdown
![Screenshot of the main dashboard](./images/dashboard.png)
\`\`\`
`
}

async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    console.log(`✓ Created directory: ${dirPath}`)
  } catch (error) {
    console.error(`✗ Failed to create directory ${dirPath}:`, error.message)
  }
}

async function createFile(filePath, content) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(filePath)
    await createDirectory(dir)
    
    // Write the file
    await fs.writeFile(filePath, content, 'utf8')
    console.log(`✓ Created file: ${filePath}`)
  } catch (error) {
    console.error(`✗ Failed to create file ${filePath}:`, error.message)
  }
}

async function setup() {
  console.log('🚀 Setting up markdown processor project...\n')
  
  // Create directories
  const directories = [
    'content',
    'content/docs', 
    'content/blog',
    'content/guides'
  ]
  
  console.log('📁 Creating directories...')
  for (const dir of directories) {
    await createDirectory(dir)
  }
  
  console.log('\n📝 Creating example files...')
  for (const [filePath, content] of Object.entries(EXAMPLE_FILES)) {
    await createFile(filePath, content)
  }
  
  console.log('\n✅ Setup complete!')
  console.log('\nNext steps:')
  console.log('1. Run `npm install` to install dependencies')
  console.log('2. Run `npm run process` to format the example files')  
  console.log('3. Check the `content/` directory for formatted examples')
  console.log('4. Add your own markdown files to the `content/` directory')
  console.log('\nAvailable commands:')
  console.log('- `npm run lint` - Check for formatting issues')
  console.log('- `npm run format` - Fix formatting issues')
  console.log('- `npm run process` - Format and lint files')
  console.log('- `npm run check-links` - Check for broken links')
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup().catch(console.error)
}

export { setup }