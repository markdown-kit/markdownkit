import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

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
