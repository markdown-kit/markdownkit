import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createMarkdownkitRemarkProcessor, formatMarkdownText } from '../remark-processor.js'

// Absolute paths outside the repository so no `.remarkrc*` is picked up.
const MDD_PATH = path.join(os.tmpdir(), 'markdownkit-escapes', 'document.mdd')
const MD_PATH = path.join(os.tmpdir(), 'markdownkit-escapes', 'document.md')

function stripPositions(node) {
  if (Array.isArray(node)) {
    return node.map(stripPositions)
  }
  if (node && typeof node === 'object') {
    const copy = {}
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'position') {
        copy[key] = stripPositions(value)
      }
    }
    return copy
  }
  return node
}

/**
 * Format `input` and prove the result parses to the same tree as the input
 * (escapes never change meaning) and is stable under a second format.
 */
async function formatPreservingSemantics(input, filePath) {
  const formatted = await formatMarkdownText(input, { filePath })
  const parser = createMarkdownkitRemarkProcessor({ filePath, lint: false, lintOnly: true })
  assert.deepEqual(
    stripPositions(parser.parse(formatted)),
    stripPositions(parser.parse(input)),
    `formatting changed the parse of:\n${input}\ninto:\n${formatted}`,
  )
  assert.equal(await formatMarkdownText(formatted, { filePath }), formatted, 'format is idempotent')
  return formatted
}

test('.mdd formatting leaves bracket placeholders, subscripts and intraword underscores literal', async () => {
  const formatted = await formatPreservingSemantics(
    [
      '---',
      'title: "Letter"',
      '---',
      '',
      '::letterhead',
      '[Company Name]',
      '[Address_Line 1]',
      '::',
      '',
      'Dear [Name], see snake_case, όνομα_χρήστη and H~2~O.',
      '',
      '[in [nested] brackets] and [unclosed text.',
      '',
      '::signature-block',
      'Name: [Print name here]',
      '::',
      '',
    ].join('\n'),
    MDD_PATH,
  )
  assert.match(formatted, /^\[Company Name\]$/mu)
  assert.match(formatted, /^\[Address_Line 1\]$/mu)
  assert.match(formatted, /Dear \[Name\], see snake_case, όνομα_χρήστη and H~2~O\./u)
  assert.match(formatted, /^\[in \[nested\] brackets\] and \[unclosed text\.$/mu)
  assert.match(formatted, /^Name: \[Print name here\]$/mu)
  assert.doesNotMatch(formatted, /\\/u)
})

test('.mdd formatting still escapes brackets, tildes and underscores that would change meaning', async () => {
  const formatted = await formatPreservingSemantics(
    [
      'A [link](http://x), a [ref][r], a footnote[^1] and \\[r] as text.',
      '',
      'Literal \\[x](y) and \\[a **b** c](d) and \\[^1] and \\[Note]: aside.',
      '',
      '~~gone~~ but \\~~kept~~ and \\_lit\\_ and \\_a and a\\_ and _emph_.',
      '',
      '[r]: http://y',
      '',
      '[^1]: note',
      '',
    ].join('\n'),
    MDD_PATH,
  )
  assert.ok(formatted.includes('A [link](http://x), a [ref][r], a footnote[^1] and \\[r] as text.'))
  assert.match(
    formatted,
    /Literal \\\[x\]\\\(y\) and \\\[a \*\*b\*\* c\]\\\(d\) and \\\[\^1\] and \\\[Note\]: aside\./u,
  )
  assert.match(
    formatted,
    /~~gone~~ but \\~\\~kept\\~\\~ and \\_lit\\_ and \\_a and a\\_ and \*emph\*\./u,
  )
})

test('.mdd formatting escapes a bracket whose closing bracket sits in a later node', async () => {
  const formatted = await formatPreservingSemantics(
    'Open \\[here **bold** there](http://x) and fine [alone **bold** here.\n',
    MDD_PATH,
  )
  // GFM autolinks the bare URL; the bracket before the bold run stays escaped.
  assert.ok(
    formatted.includes('Open \\[here **bold** there]\\(<http://x>) and fine [alone **bold** here.'),
  )
})

test('.md formatting keeps bracket escapes (remark-lint reports undefined references) but not intraword underscores', async () => {
  const formatted = await formatPreservingSemantics(
    'Hi \\[Company Name], snake_case and statement_timeout here, ~~s~~ and \\~t\\~.\n',
    MD_PATH,
  )
  assert.equal(
    formatted,
    'Hi \\[Company Name], snake_case and statement_timeout here, ~~s~~ and \\~t\\~.\n',
  )
})
