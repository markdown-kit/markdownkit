import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repo = path.resolve(__dirname, '..')
const cli = path.join(repo, 'cli.js')
const fixturesRoot = path.join(repo, 'test', 'cases')

function run(args, cwd = repo) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function row(name, pass, details = {}) {
  return { name, pass, ...details }
}

async function main() {
  const workRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'markdownkit-real-cases-'))
  await fs.cp(fixturesRoot, path.join(workRoot, 'cases'), { recursive: true })

  const results = []

  {
    const filePath = path.join(workRoot, 'cases', 'quiet', 'input.txt')
    const r = run(['autoformat', '-q', filePath])
    const pass =
      r.status === 0 && !r.stdout.includes('AUTO-FORMAT MODE') && !r.stdout.includes('Formatted:')

    results.push(
      row('quiet-short-flag', pass, {
        exit: r.status,
        stdoutSnippet: r.stdout.trim().slice(0, 120),
        stderrSnippet: r.stderr.trim().slice(0, 120),
      }),
    )
  }

  {
    const dirPath = path.join(workRoot, 'cases', 'recursive')
    const nestedFile = path.join(dirPath, 'sub', 'nested.txt')
    const r = run(['autoformat', '-r', dirPath])
    const content = await fs.readFile(nestedFile, 'utf8')
    const pass =
      r.status === 0 && /Recursive folder processing|# Recursive folder processing/.test(content)

    results.push(
      row('recursive-short-flag', pass, {
        exit: r.status,
        outputSnippet: content.trim().slice(0, 120),
      }),
    )
  }

  {
    const filePath = path.join(workRoot, 'cases', 'semantic', 'input.txt')
    const r = run(['autoformat', '--semantic', '--width', '40', filePath])
    const content = await fs.readFile(filePath, 'utf8')
    const pass =
      r.status === 0 &&
      !r.stderr.includes('Cannot access 40') &&
      content.includes('\nThis second sentence should appear on a new line') &&
      !content.includes('\n.\n')

    results.push(
      row('width-option-value-and-semantic-wrap', pass, {
        exit: r.status,
        outputSnippet: content.trim().slice(0, 180),
      }),
    )
  }

  {
    const filePath = path.join(workRoot, 'cases', 'draft-header', 'input.txt')
    const r = run(['draft', '--dry-run', '--header-level', '2', filePath])
    const pass =
      r.status === 0 && r.stdout.includes('## Docs') && !r.stderr.includes('Cannot access 2')

    results.push(
      row('draft-header-level-value', pass, {
        exit: r.status,
        stdoutSnippet: r.stdout.split('\n').slice(-8).join('\n'),
      }),
    )
  }

  {
    const setupDir = path.join(workRoot, 'setup-run')
    await fs.mkdir(setupDir, { recursive: true })
    const r = run(['setup'], setupDir)
    const expectedPath = path.join(setupDir, 'content', 'docs', 'getting-started.md')

    let exists = true
    try {
      await fs.access(expectedPath)
    } catch {
      exists = false
    }

    const pass = r.status === 0 && exists

    results.push(
      row('setup-command-end-to-end', pass, {
        exit: r.status,
        createdFile: expectedPath,
        stdoutSnippet: r.stdout.split('\n').slice(0, 6).join('\n'),
      }),
    )
  }

  {
    const pluginDir = path.join(workRoot, 'cases', 'plugins')
    const filePath = path.join(pluginDir, 'input.txt')
    const r = run(['autoformat', '--plugins', pluginDir, filePath])
    const content = await fs.readFile(filePath, 'utf8')
    const pass =
      r.status === 0 &&
      content.includes('- [ ] ship markdownkit parser hardening') &&
      !content.startsWith('# - [ ]')

    results.push(
      row('plugins-directory', pass, {
        exit: r.status,
        outputSnippet: content.trim().slice(0, 140),
      }),
    )
  }

  {
    const pluginFile = path.join(workRoot, 'cases', 'plugins', 'todo-plugin.js')
    const filePath = path.join(workRoot, 'cases', 'plugins', 'input-single.txt')
    await fs.writeFile(filePath, 'TODO: verify single file plugin path\n', 'utf8')

    const r = run(['autoformat', '--plugins', pluginFile, filePath])
    const content = await fs.readFile(filePath, 'utf8')
    const pass =
      r.status === 0 &&
      content.includes('- [ ] verify single file plugin path') &&
      !content.startsWith('# - [ ]')

    results.push(
      row('plugins-single-file', pass, {
        exit: r.status,
        outputSnippet: content.trim().slice(0, 140),
      }),
    )
  }

  {
    const filePath = path.join(workRoot, 'cases', 'draft-quality', 'input.txt')
    const r = run(['draft', '--dry-run', filePath])

    const pass =
      r.status === 0 &&
      !r.stdout.includes('# we need to tidy up') &&
      r.stdout.includes('accuracy of docs') &&
      r.stdout.includes('we have set up a nice style')

    results.push(
      row('draft-quality-transform', pass, {
        exit: r.status,
        stdoutSnippet: r.stdout.split('\n').slice(-14).join('\n'),
      }),
    )
  }

  {
    const nuclearFile = path.join(workRoot, 'cases', 'nuclear', 'input.md')
    const r = run(['nuclear', nuclearFile])
    const probePath = path.join(repo, '.oxlint-mdx-probe.md')

    let probeExists = true
    try {
      await fs.access(probePath)
    } catch {
      probeExists = false
    }

    const pass = !probeExists

    results.push(
      row('nuclear-no-probe-side-effect', pass, {
        exit: r.status,
        probePath,
        probeExists,
        stdoutSnippet: r.stdout.split('\n').slice(0, 10).join('\n'),
      }),
    )
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed

  console.log('=== MARKDOWNKIT REAL CASE MATRIX ===')
  console.log(`workRoot=${workRoot}`)
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} :: ${r.name} :: exit=${r.exit ?? 'n/a'}`)
  }
  console.log(`SUMMARY: ${passed}/${results.length} passed, ${failed} failed`)
  console.log(JSON.stringify(results, null, 2))

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(`Fatal integration runner error: ${err.message}`)
  process.exit(1)
})
