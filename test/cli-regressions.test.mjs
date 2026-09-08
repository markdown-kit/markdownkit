import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const CLI_PATH = path.join(REPO_ROOT, 'cli.js')

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  })
}

async function makeTempDir(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`))
}

test('short quiet flag (-q) suppresses autoformat logs', async () => {
  const tmp = await makeTempDir('markdownkit-test-q')
  const inputPath = path.join(tmp, 'note.txt')
  await writeFile(inputPath, 'this is a short note\n', 'utf8')

  const result = runCli(['autoformat', '-q', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.doesNotMatch(result.stdout, /AUTO-FORMAT MODE/)
  assert.doesNotMatch(result.stdout, /Formatted:/)
})

test('short recursive flag (-r) processes directory inputs', async () => {
  const tmp = await makeTempDir('markdownkit-test-r')
  const nestedDir = path.join(tmp, 'nested')
  await mkdir(nestedDir, { recursive: true })

  const inputPath = path.join(nestedDir, 'note.txt')
  await writeFile(inputPath, 'nested draft line\n', 'utf8')

  const result = runCli(['autoformat', '-r', tmp], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /Nested draft line|# Nested draft line/)
})

test('--width value is parsed as option value, not file arg', async () => {
  const tmp = await makeTempDir('markdownkit-test-width')
  const inputPath = path.join(tmp, 'semantic.txt')
  await writeFile(
    inputPath,
    'we should split this very long sentence at a semantic boundary because width is intentionally small. This second sentence should move to a new line.\n',
    'utf8',
  )

  const result = runCli(['autoformat', '--semantic', '--width', '40', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /\nThis second sentence should move to a new line\./)
  assert.doesNotMatch(output, /\n\.\n/)
})

test('--header-level value is parsed correctly in draft mode', async () => {
  const tmp = await makeTempDir('markdownkit-test-header-level')
  const inputPath = path.join(tmp, 'draft.txt')
  await writeFile(inputPath, 'docs/\nthis is draft content\n', 'utf8')

  const result = runCli(['draft', '--dry-run', '--header-level', '2', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /## Docs/)
})

test('setup command executes end-to-end from CLI', async () => {
  const tmp = await makeTempDir('markdownkit-test-setup')

  const result = runCli(['setup'], tmp)

  assert.equal(result.status, 0, result.stderr)

  const gettingStarted = path.join(tmp, 'content', 'docs', 'getting-started.md')
  const styleGuide = path.join(tmp, 'content', 'guides', 'style-guide.md')

  const gettingStartedContent = await readFile(gettingStarted, 'utf8')
  const styleGuideContent = await readFile(styleGuide, 'utf8')

  assert.match(gettingStartedContent, /# Getting Started Guide/)
  assert.match(styleGuideContent, /# Markdown Style Guide/)
})

test('--plugins loads custom rules for autoformat', async () => {
  const tmp = await makeTempDir('markdownkit-test-plugins')
  const pluginDir = path.join(tmp, 'plugins')
  await mkdir(pluginDir, { recursive: true })

  const pluginPath = path.join(pluginDir, 'todo-plugin.js')
  await writeFile(
    pluginPath,
    `export default {
  name: 'todo-plugin',
  rules: [
    {
      name: 'todo-checkbox',
      pattern: /^TODO:\\s*(.+)$/,
      transform: (match) => '- [ ] ' + match[1],
    },
  ],
};
`,
    'utf8',
  )

  const inputPath = path.join(tmp, 'tasks.txt')
  await writeFile(inputPath, 'TODO: ship parser fixes\n', 'utf8')

  const result = runCli(['autoformat', '--plugins', pluginDir, inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /- \[ \] ship parser fixes/)
  assert.doesNotMatch(output, /^#\s*-\s*\[\s\]/m)
})

test('nuclear ignores extension-like directory names', async () => {
  const tmp = await makeTempDir('markdownkit-test-nodir')
  const mdxDir = path.join(tmp, 'llms.mdx')
  await mkdir(mdxDir, { recursive: true })
  await writeFile(path.join(mdxDir, '.keep'), 'keep\n', 'utf8')
  await writeFile(path.join(tmp, 'README.md'), '# Title\n\nShort content.\n', 'utf8')

  const result = runCli(['nuclear'], tmp)

  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /EISDIR|illegal operation on a directory/,
  )
})

test('mdx files are not forced through markdown-style-guide extension rule', async () => {
  const tmp = await makeTempDir('markdownkit-test-mdx-profile')
  const inputPath = path.join(tmp, 'guide.mdx')
  await writeFile(
    inputPath,
    '# Guide\n\n1. First\n2. Second\n\nThis is a deliberately long line in mdx content that should not fail specifically due markdown-only extension policy.\n',
    'utf8',
  )

  const result = runCli(['lint', inputPath], REPO_ROOT)
  const combined = `${result.stdout}\n${result.stderr}`

  assert.doesNotMatch(combined, /file-extension/)
})

test('format does not escape underscores in snake_case technical tokens', async () => {
  const tmp = await makeTempDir('markdownkit-test-underscore-escape')
  const inputPath = path.join(tmp, 'spec.md')
  await writeFile(
    inputPath,
    '# CAPYDB\n\nCREATE ROLE usr_abc WITH LOGIN PASSWORD;\n\nDaily backups use pg_dump and statement_timeout monitoring.\n',
    'utf8',
  )

  const result = runCli(['format', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /usr_abc/)
  assert.match(output, /pg_dump/)
  assert.match(output, /statement_timeout/)
  assert.doesNotMatch(output, /usr\\_abc|pg\\_dump|statement\\_timeout/)
})

test('format honors project .remarkrc.js plugin configuration', async () => {
  const tmp = await makeTempDir('markdownkit-test-config')
  const configPath = path.join(tmp, '.remarkrc.js')
  const inputPath = path.join(tmp, 'list.md')

  await writeFile(
    configPath,
    `export default {
  plugins: [
    'remark-gfm',
    ['remark-stringify', { bullet: '*', emphasis: '*', strong: '*', listItemIndent: 'one' }]
  ]
}
`,
    'utf8',
  )
  await writeFile(inputPath, '- item\n', 'utf8')

  const result = runCli(['format', inputPath], tmp)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /^\* item/m)
})

test('default file discovery honors .remarkignore patterns', async () => {
  const tmp = await makeTempDir('markdownkit-test-ignore')
  const ignoredPath = path.join(tmp, 'ignored.md')
  const includedPath = path.join(tmp, 'included.md')

  await writeFile(path.join(tmp, '.remarkignore'), 'ignored.md\n', 'utf8')
  await writeFile(
    path.join(tmp, '.remarkrc.js'),
    `export default {
  plugins: [
    'remark-gfm',
    ['remark-stringify', { bullet: '*', emphasis: '*', strong: '*', listItemIndent: 'one' }]
  ]
}
`,
    'utf8',
  )
  await writeFile(ignoredPath, '- item\n', 'utf8')
  await writeFile(includedPath, '- item\n', 'utf8')

  const result = runCli(['format'], tmp)

  assert.equal(result.status, 0, result.stderr)

  const ignoredOutput = await readFile(ignoredPath, 'utf8')
  const includedOutput = await readFile(includedPath, 'utf8')

  assert.match(ignoredOutput, /^- item/m)
  assert.match(includedOutput, /^\* item/m)
})

test('format honors project .remarkrc.js settings without explicit plugins', async () => {
  const tmp = await makeTempDir('markdownkit-test-config-settings-only')
  const configPath = path.join(tmp, '.remarkrc.js')
  const inputPath = path.join(tmp, 'list.md')

  await writeFile(
    configPath,
    `export default {
  settings: { bullet: '*' }
}
`,
    'utf8',
  )
  await writeFile(inputPath, '- item\n', 'utf8')

  const result = runCli(['format', inputPath], tmp)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /^\* item/m)
})

test('check fails on formatting drift without changing the file', async () => {
  const tmp = await makeTempDir('markdownkit-test-check-drift')
  const inputPath = path.join(tmp, 'document.md')
  const input = '# Title\n\n\nParagraph\n'
  await writeFile(inputPath, input, 'utf8')

  const result = runCli(['check', inputPath], tmp)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Formatting differs/u)
  assert.equal(await readFile(inputPath, 'utf8'), input)
})

test('check succeeds for an already formatted file', async () => {
  const tmp = await makeTempDir('markdownkit-test-check-clean')
  const inputPath = path.join(tmp, 'document.md')
  await writeFile(inputPath, '# Title\n\nParagraph\n', 'utf8')

  const result = runCli(['check', inputPath], tmp)

  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /Formatting differs/u)
})

test('format honors semantic line-break and wrap-width options', async () => {
  const { formatMarkdownText } = await import('../remark-processor.js')
  const source =
    '# Title\n\nThis sentence is deliberately long enough to cross the configured width. This sentence must begin on a new semantic line.\n'

  const formatted = await formatMarkdownText(source, {
    filePath: 'document.md',
    semanticBreaks: true,
    wrapWidth: 70,
  })

  assert.match(formatted, /width\.\nThis sentence/u)
})

test('draft dry-run polish completes successfully', async () => {
  const tmp = await makeTempDir('markdownkit-test-draft-polish')
  const inputPath = path.join(tmp, 'draft.md')
  await writeFile(inputPath, 'project notes\nthis is a rough paragraph\n', 'utf8')

  const result = runCli(['draft', '--dry-run', '--polish', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout + result.stderr, /is not defined/)
  assert.match(result.stdout, /File:/)
})

test('semantic breaks never split frontmatter, table rows, or fenced code', async () => {
  const { formatMarkdownText } = await import('../remark-processor.js')
  const longSentencePair =
    'This sentence is deliberately long enough to cross the configured width. This sentence must stay put.'
  const source = `---
title: "${longSentencePair}"
---

# Title

| Column | Value |
| ------ | ----- |
| Row | ${longSentencePair} |

\`\`\`text
${longSentencePair}
\`\`\`

${longSentencePair}
`

  const formatted = await formatMarkdownText(source, {
    filePath: 'document.md',
    semanticBreaks: true,
    wrapWidth: 60,
  })

  assert.ok(formatted.includes(`title: "${longSentencePair}"`))
  assert.match(
    formatted,
    /\| Row {2,}\| This sentence is deliberately long enough to cross the configured width\. This sentence must stay put\. \|/u,
  )
  assert.match(
    formatted,
    /```text\nThis sentence is deliberately long enough to cross the configured width\. This sentence must stay put\.\n```/u,
  )
  // The prose paragraph is the only place a semantic break is inserted.
  assert.match(formatted, /width\.\nThis sentence must stay put\.\n$/u)
})

test('nuclear polish preset applies typography without restructuring existing markdown', async () => {
  const { TextProcessor } = await import('../text-processor.js')
  const { createNuclearPolishOptions } = await import('../command-presets.js')
  const source = `---
title: "keep 'straight' quotes..."
---

# Title

Phone: call "the office" first...
See <a href="x">link</a> and {props.value} and "quoted" text.
Line with a hard break  
continues here.

    indented code stays code

\`\`\`sh
# not a heading, "quotes" untouched
\`\`\`
`
  const output = await new TextProcessor(createNuclearPolishOptions()).process(source)

  assert.match(output, /^title: "keep 'straight' quotes\.\.\."$/mu)
  assert.match(output, /Phone: call “the office” first…/u)
  assert.match(output, /See <a href="x">link<\/a> and \{props\.value\} and “quoted” text\./u)
  assert.doesNotMatch(output, /\*\*Phone:\*\*/u)
  assert.match(output, /Line with a hard break {2}\ncontinues here\./u)
  assert.match(output, /\n {4}indented code stays code\n/u)
  assert.match(output, /```sh\n# not a heading, "quotes" untouched\n```/u)
})

test('autoformat honors --smart-quotes without enabling NLP', async () => {
  const tmp = await makeTempDir('markdownkit-test-smart-quotes')
  const inputPath = path.join(tmp, 'note.txt')
  await writeFile(inputPath, 'she said "hello" and left...\n', 'utf8')

  const result = runCli(['autoformat', '-q', '--smart-quotes', '--ellipsis', inputPath], REPO_ROOT)

  assert.equal(result.status, 0, result.stderr)
  const output = await readFile(inputPath, 'utf8')
  assert.match(output, /“hello”/u)
  assert.match(output, /left…/u)
})
