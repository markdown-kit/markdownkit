import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { defaultHandlers } from 'mdast-util-to-markdown'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkLintNoUndefinedReferences from 'remark-lint-no-undefined-references'
import remarkMdc from 'remark-mdc'
import remarkMdx from 'remark-mdx'
import remarkPresetLintConsistent from 'remark-preset-lint-consistent'
import remarkPresetLintMarkdownStyleGuide from 'remark-preset-lint-markdown-style-guide'
import remarkPresetLintRecommended from 'remark-preset-lint-recommended'
import remarkStringify from 'remark-stringify'
import remarkTypography from 'remark-typography'
import { visit } from 'unist-util-visit'

import { TextProcessor } from './text-processor.js'

export const RICH_MARKDOWN_EXTENSIONS = new Set(['.mdx', '.mdc', '.mdd'])

export const DEFAULT_STRINGIFY_OPTIONS = {
  bullet: '-',
  emphasis: '*',
  fences: true,
  listItemIndent: 'one',
  rule: '-',
  strong: '*',
  tightDefinitions: true,
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u

/** CommonMark label matching: case-folded, whitespace-collapsed. */
function normalizeLabel(label) {
  return label.trim().toLowerCase().replace(/\s+/gu, ' ')
}

/**
 * Labels a `[…]` in prose could resolve against: link definitions, and
 * footnote definitions prefixed with `^` as they appear in a reference.
 */
function collectDefinitionLabels(tree) {
  const labels = new Set()
  visit(tree, ['definition', 'footnoteDefinition'], (node) => {
    const label = normalizeLabel(node.label ?? node.identifier ?? '')
    labels.add(node.type === 'footnoteDefinition' ? `^${label}` : label)
  })
  return labels
}

/** Index of the `]` that balances the `[` at `open`, or -1. */
function findClosingBracket(value, open) {
  let depth = 0
  for (let index = open; index < value.length; index++) {
    if (value[index] === '[') {
      depth++
    } else if (value[index] === ']' && --depth === 0) {
      return index
    }
  }
  return -1
}

function laterSiblingsContainBracket(parent, node) {
  const siblings = parent?.children ?? []
  let found = false
  for (const sibling of siblings.slice(siblings.indexOf(node) + 1)) {
    visit(sibling, 'text', (leaf) => {
      if (leaf.value.includes(']')) {
        found = true
      }
    })
  }
  return found
}

/**
 * Build the `text` handler that escapes what Markdown actually needs instead
 * of the defensive set mdast-util-to-markdown applies to every occurrence:
 *
 * - `_` between two word characters can never open or close emphasis
 *   (CommonMark flanking rules), so `snake_case` stays literal;
 * - with `relaxBrackets`, `[` is escaped only where it could start a link or
 *   reference: a `[…]` group followed by `(`, `[` or `:`, one whose label
 *   matches a definition in the document, or one whose closing bracket lies
 *   in a later sibling node. Bare placeholders such as `[Company Name]` stay
 *   literal;
 * - with `relaxTildes`, `~` is escaped only inside a `~~` run (single tildes
 *   are MDD subscripts and single-tilde strikethrough is off for `.mdd`).
 *
 * Every other character keeps the default escaping, and the retained
 * patterns still apply inside link labels and references.
 */
function createTextHandler({ relaxBrackets = false, relaxTildes = false } = {}) {
  const relaxed = new Set(['_'])
  if (relaxBrackets) {
    relaxed.add('[')
  }
  if (relaxTildes) {
    relaxed.add('~')
  }
  const unsafeCache = new WeakMap()

  // Drop the prose-wide escapes for the relaxed characters (the handler
  // decides those itself) but keep them inside labels and references.
  function relaxedUnsafe(state) {
    let patterns = unsafeCache.get(state)
    if (!patterns) {
      patterns = state.unsafe.flatMap((pattern) => {
        if (!relaxed.has(pattern.character)) {
          return [pattern]
        }
        const constructs = [pattern.inConstruct ?? []].flat().filter((name) => name !== 'phrasing')
        if (pattern.atBreak || constructs.length === 0) {
          return []
        }
        return [{ ...pattern, _compiled: undefined, inConstruct: constructs }]
      })
      unsafeCache.set(state, patterns)
    }
    return patterns
  }

  function mustEscape(value, index, node, parent, state, info) {
    const character = value[index]
    const previous = index > 0 ? value[index - 1] : (info.before ?? '').slice(-1)
    const next = index + 1 < value.length ? value[index + 1] : (info.after ?? '').slice(0, 1)

    if (character === '_') {
      return !(WORD_CHARACTER.test(previous) && WORD_CHARACTER.test(next))
    }
    if (character === '~') {
      return previous === '~' || next === '~'
    }
    if (character === '[') {
      const close = findClosingBracket(value, index)
      if (close === -1) {
        return laterSiblingsContainBracket(parent, node)
      }
      const afterClose =
        close + 1 < value.length ? value[close + 1] : (info.after ?? '').slice(0, 1)
      if (afterClose === '(' || afterClose === '[' || afterClose === ':') {
        return true
      }
      return (state.definitionLabels ?? new Set()).has(
        normalizeLabel(value.slice(index + 1, close)),
      )
    }
    return false
  }

  return function text(node, parent, state, info) {
    const { value } = node
    const original = state.unsafe
    state.unsafe = relaxedUnsafe(state)
    try {
      let output = ''
      let start = 0
      for (let index = 0; index < value.length; index++) {
        if (!relaxed.has(value[index]) || !mustEscape(value, index, node, parent, state, info)) {
          continue
        }
        output += state.safe(value.slice(start, index), {
          ...info,
          before: start === 0 ? info.before : value[start - 1],
          after: value[index],
        })
        output += `\\${value[index]}`
        start = index + 1
      }
      return (
        output +
        state.safe(value.slice(start), {
          ...info,
          before: start === 0 ? info.before : value[start - 1],
        })
      )
    } finally {
      state.unsafe = original
    }
  }
}

/** Serialisation handlers shared by every markdownkit processor. */
export function getStringifyHandlers(filePath = '') {
  const isMdd = path.extname(filePath).toLowerCase() === '.mdd'
  return {
    break: () => '  \n',
    root(node, parent, state, info) {
      state.definitionLabels = collectDefinitionLabels(node)
      return defaultHandlers.root(node, parent, state, info)
    },
    text: createTextHandler({ relaxBrackets: isMdd, relaxTildes: isMdd }),
  }
}

const packageRequire = createRequire(import.meta.url)
const remarkConfigCache = new Map()

export function shouldUseMarkdownStyleGuide(filePath = '') {
  const extension = path.extname(filePath).toLowerCase()
  return !RICH_MARKDOWN_EXTENSIONS.has(extension)
}

export function getStringifyOptions(filePath = '') {
  const extension = path.extname(filePath).toLowerCase()
  const handlers = getStringifyHandlers(filePath)

  if (extension === '.mdx' || extension === '.mdd') {
    return {
      ...DEFAULT_STRINGIFY_OPTIONS,
      fences: false,
      handlers,
    }
  }

  return { ...DEFAULT_STRINGIFY_OPTIONS, handlers }
}

export function remarkConditionalMarkdownStyleGuide() {
  const styleGuideProcessor = remark().use(remarkPresetLintMarkdownStyleGuide).freeze()

  return async function transformer(tree, file) {
    if (!shouldUseMarkdownStyleGuide(file.path ?? '')) {
      return
    }

    await styleGuideProcessor.run(tree, file)
  }
}

async function loadRemarkConfig(cwd = process.cwd()) {
  const resolvedCwd = path.resolve(cwd)
  if (remarkConfigCache.has(resolvedCwd)) {
    return remarkConfigCache.get(resolvedCwd)
  }

  const candidates = ['.remarkrc.js', '.remarkrc.mjs', '.remarkrc.cjs']
  let currentDir = resolvedCwd

  while (true) {
    if (remarkConfigCache.has(currentDir)) {
      const cached = remarkConfigCache.get(currentDir)
      remarkConfigCache.set(resolvedCwd, cached)
      return cached
    }

    for (const candidate of candidates) {
      const configPath = path.join(currentDir, candidate)

      try {
        const stat = await fs.stat(configPath)
        const module = await import(`${pathToFileURL(configPath).href}?mtime=${stat.mtimeMs}`)
        const config = module.default ?? module
        remarkConfigCache.set(currentDir, config)
        remarkConfigCache.set(resolvedCwd, config)
        return config
      } catch (err) {
        if (err?.code !== 'ENOENT') {
          throw err
        }
      }
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }
    currentDir = parentDir
  }

  remarkConfigCache.set(resolvedCwd, null)
  return null
}

async function resolveConfiguredPlugin(pluginEntry, cwd) {
  if (typeof pluginEntry !== 'string') {
    return pluginEntry
  }

  const requireFromCwd = createRequire(path.join(cwd, '__markdownkit__.cjs'))
  let resolvedPath

  try {
    resolvedPath = requireFromCwd.resolve(pluginEntry)
  } catch {
    resolvedPath = packageRequire.resolve(pluginEntry)
  }

  const module = await import(pathToFileURL(resolvedPath).href)
  return module.default ?? module
}

/** Dialect/parse plugins that must only run for their matching file extension. */
const EXTENSION_SCOPED_PLUGINS = new Map([
  ['remark-mdx', '.mdx'],
  ['remark-mdc', '.mdc'],
])

/** One-way MDD transform plugins — never applied in the format/lint pipeline. */
const MDD_TRANSFORM_PLUGINS = new Set([
  '@markdownkit/remark-mdd/plugins/document-structure',
  '@markdownkit/remark-mdd/plugins/text-formatting',
])

/**
 * Drop dialect plugins that do not match the file's extension and the one-way
 * MDD transform plugins. MDX/MDC are parser extensions: applying remark-mdx to
 * a `.mdd` file crashes on `{.class}` and remark-mdc rewrites `::directives`.
 * The MDD transform plugins emit HTML markers and would corrupt `.mdd` source
 * if stringified back — `.mdd` rendering is delegated to @markdownkit/mdd.
 *
 * @param {Array<unknown>} plugins
 * @param {string} filePath
 * @returns {Array<unknown>}
 */
function filterPluginsForFile(plugins, filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return plugins.filter((entry) => {
    const name = Array.isArray(entry) ? entry[0] : entry
    if (typeof name !== 'string') {
      return true
    }
    if (MDD_TRANSFORM_PLUGINS.has(name)) {
      return false
    }
    const requiredExtension = EXTENSION_SCOPED_PLUGINS.get(name)
    if (requiredExtension && requiredExtension !== extension) {
      return false
    }
    return true
  })
}

export function clearRemarkConfigCache() {
  remarkConfigCache.clear()
}

export async function createConfiguredMarkdownkitRemarkProcessor(options = {}) {
  const { filePath = '', lintOnly = false, typography = false, cwd = process.cwd() } = options
  const config = await loadRemarkConfig(cwd)

  if (!config?.plugins) {
    return createMarkdownkitRemarkProcessor({
      ...options,
      filePath,
      lintOnly,
      typography,
      stringifySettings: config?.settings ?? {},
    })
  }

  // Serialisation handlers ride on `settings` so a project's own
  // `remark-stringify` options merge with them rather than replace them.
  let processor = remark().data('settings', {
    ...config.settings,
    handlers: { ...config.settings?.handlers, ...getStringifyHandlers(filePath) },
  })

  for (const pluginEntry of filterPluginsForFile(config.plugins, filePath)) {
    if (Array.isArray(pluginEntry)) {
      const [pluginName, pluginOptions] = pluginEntry
      const plugin = await resolveConfiguredPlugin(pluginName, cwd)
      processor = processor.use(plugin, pluginOptions)
      continue
    }

    const plugin = await resolveConfiguredPlugin(pluginEntry, cwd)
    processor = processor.use(plugin)
  }

  if (typography) {
    processor = processor.use(remarkTypography)
  }

  return processor
}

export function createMarkdownkitRemarkProcessor(options = {}) {
  const {
    filePath = 'document.md',
    frontmatter = true,
    gfm = true,
    mdc = true,
    mdx = true,
    lint = true,
    strict = true,
    lintOnly = false,
    typography = false,
    stringifySettings = {},
  } = options

  // MDX and MDC hook the PARSER (micromark extensions), so they must be
  // selected by file extension at build time — they cannot be gated after
  // parsing. Applying remark-mdx to a `.mdd` file crashes on `{.class}`
  // annotations, and remark-mdc rewrites `::directive` blocks. Each dialect is
  // therefore applied only to its own extension. The one-way MDD transform
  // plugins are intentionally NOT applied here: they emit HTML markers for
  // preview/conversion and would corrupt the source if stringified back.
  // `.mdd` rendering is delegated to @markdownkit/mdd.
  const extension = path.extname(filePath).toLowerCase()

  let processor = remark()

  if (frontmatter) {
    processor = processor.use(remarkFrontmatter, ['yaml'])
  }

  if (gfm) {
    // On `.mdd`, disable single-tilde strikethrough so MDD subscripts (`~x~`)
    // are preserved rather than being rewritten to GFM strikethrough (`~~x~~`).
    processor = processor.use(remarkGfm, extension === '.mdd' ? { singleTilde: false } : undefined)
  }

  if (mdx && extension === '.mdx') {
    processor = processor.use(remarkMdx)
  } else if (mdc && extension === '.mdc') {
    processor = processor.use(remarkMdc)
  }

  if (lint) {
    processor = processor.use(remarkPresetLintRecommended)
    processor = processor.use(remarkPresetLintConsistent)

    // MDD documents use `[Company Name]`-style placeholders as plain text (the
    // spec's signature block is one), which the formatter leaves unescaped;
    // reporting them as undefined references would contradict that.
    if (extension === '.mdd') {
      processor = processor.use(remarkLintNoUndefinedReferences, false)
    }

    if (strict) {
      processor = processor.use(remarkConditionalMarkdownStyleGuide)
    }
  }

  if (typography) {
    processor = processor.use(remarkTypography)
  }

  if (!lintOnly) {
    processor = processor.use(remarkStringify, {
      ...getStringifyOptions(filePath),
      ...stringifySettings,
    })
  }

  return processor
}

/**
 * The processor for a file. `.mdd` uses the dedicated MDD-safe processor (no
 * MDX/MDC parsing, no single-tilde strikethrough, no one-way transform,
 * bracket placeholders allowed) rather than the generic markdown-oriented
 * `.remarkrc` config, so directives, semantic classes and sub/superscripts
 * survive a format round-trip intact. Everything else resolves the project's
 * `.remarkrc*` from the file's directory upward.
 */
export async function createProcessorForFile(options = {}) {
  const filePath = options.filePath ?? 'document.md'
  const cwd = options.cwd ?? (path.isAbsolute(filePath) ? path.dirname(filePath) : process.cwd())

  return path.extname(filePath).toLowerCase() === '.mdd'
    ? createMarkdownkitRemarkProcessor({ ...options, filePath })
    : await createConfiguredMarkdownkitRemarkProcessor({ ...options, filePath, cwd })
}

export async function formatMarkdownText(text, options = {}) {
  const filePath = options.filePath ?? 'document.md'
  const processor = await createProcessorForFile({ ...options, filePath, lintOnly: false })

  const input = options.semanticBreaks
    ? new TextProcessor({
        semanticBreaks: true,
        wrapWidth: options.wrapWidth ?? 88,
      }).applySemanticBreaks(text)
    : text

  const result = await processor.process({
    value: input,
    path: filePath,
  })

  return String(result)
}
