import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { remarkMddDocumentStructure } from '@markdownkit/remark-mdd'
import { extractDirectives, validateDocument } from '@markdownkit/remark-mdd/validator'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

import { formatMarkdownText } from '../remark-processor.js'

// Absolute paths outside the repository so no `.remarkrc*` is picked up.
const TMP = path.join(os.tmpdir(), 'markdownkit-structure')

for (const extension of ['.md', '.mdx', '.mdd']) {
  test(`${extension} formatting keeps a language-less fenced code block fenced`, async () => {
    const filePath = path.join(TMP, `document${extension}`)
    const input = '# Title\n\nText\n\n```\nplain code\n```\n\nMore text\n'

    const once = await formatMarkdownText(input, { filePath })
    const twice = await formatMarkdownText(once, { filePath })

    assert.match(once, /\n```\nplain code\n```\n/u)
    assert.equal(twice, once, 'format is idempotent')
  })
}

// The four MDD example documents (copied from remark-mdd/test/fixtures).
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'mdd')

/** Rewrite an MDD 3 document in the MDD 2 spelling that tools still read. */
function toMdd2(source) {
  return source
    .replace(/^:::([a-z][a-z0-9-]*)$/gmu, '::$1')
    .replace(/^:::$/gmu, '::')
    .replace(/^::page-break$/gmu, '::page-break ::')
    .replace(/^::section-break$/gmu, '::: section-break :::')
}

const FRONTMATTER =
  '---\ntitle: "T"\ndate: "2024-01-01"\nauthor: "A"\ndocument-type: "letter"\n---\n\n'

const MDD_CASES = [
  ...readdirSync(FIXTURES).flatMap((name) => {
    const source = readFileSync(path.join(FIXTURES, name), 'utf8')
    return [
      { name: `${name} (MDD 3)`, source },
      { name: `${name} (MDD 2 spelling)`, source: toMdd2(source) },
    ]
  }),
  {
    name: 'table inside a block',
    source: `${FRONTMATTER}:::signature-block\n| A | B |\n|---|---|\n| 1 | 2 |\n:::\n\nAfter.\n`,
  },
  {
    name: 'list inside a block',
    source: `${FRONTMATTER}:::contact-info\n- Phone\n- Email\n:::\n\nAfter.\n`,
  },
  {
    name: 'thematic breaks inside a block',
    source: `${FRONTMATTER}:::signature-block\n\n---\n\nName\n\n---\n\nDate\n:::\n`,
  },
]

function validationCodes(source) {
  const { errors, warnings } = validateDocument(source, { strict: false })
  return {
    errors: errors.map((error) => error.code).sort(),
    warnings: warnings.map((warning) => warning.code).sort(),
  }
}

/**
 * Directives rendered by the paragraph-scanning path of remark-mdd (the one
 * mdd preview/convert use, without remark-directive).
 */
async function renderedDirectives(source) {
  const processor = remark()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMddDocumentStructure)
  const file = { value: source, path: 'document.mdd' }
  const tree = await processor.run(processor.parse(file), file)
  const found = []
  visit(tree, (node) => {
    const directive = node.data?.hProperties?.['data-mdd-directive']
    if (directive) {
      found.push(directive)
    }
  })
  return found
}

const directiveLines = (source) => source.split('\n').filter((line) => /^\\?:{2,}/u.test(line))

for (const { name, source } of MDD_CASES) {
  test(`.mdd formatting keeps directives intact: ${name}`, async () => {
    const filePath = path.join(TMP, 'document.mdd')
    const once = await formatMarkdownText(source, { filePath })

    assert.equal(await formatMarkdownText(once, { filePath }), once, 'format is idempotent')
    assert.deepEqual(directiveLines(once), directiveLines(source), 'directive lines unchanged')
    // Formatting may repair a document (a blank line before a closer that
    // follows a table or list), but must never introduce a finding.
    const before = validationCodes(source)
    const after = validationCodes(once)
    for (const kind of ['errors', 'warnings']) {
      const introduced = after[kind].filter((code) => !before[kind].includes(code))
      assert.deepEqual(introduced, [], `formatting introduces no validator ${kind}`)
    }
    assert.equal(
      (await renderedDirectives(once)).length,
      extractDirectives(source).length,
      'every directive still renders',
    )
  })
}
