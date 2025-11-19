/**
 * ESLint configuration for MDX files
 * Uses eslint-plugin-mdx with existing remark-lint configuration
 *
 * This integrates with the existing .remarkrc.js file to provide:
 * - JSX/JavaScript linting inside MDX code blocks
 * - IDE integration for better developer experience
 * - Unified linting workflow alongside remark-lint
 */

import * as mdxPlugin from 'eslint-plugin-mdx';

export default [
  {
    // Ignore common directories
    // Replaces .eslintignore file (no longer supported in ESLint 9)
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      'pnpm-lock.yaml',
      '**/*.config.js',
      '**/*.config.mjs',
      'README.md',
      'CHANGELOG.md',
      'LICENSE',
      'PUBLISHING.md',
      'ESLINT_INTEGRATION.md',
      '.cache/**',
      '.remark-cache/**'
    ]
  },

  // MDX/MDC files configuration
  {
    name: 'custom/mdx/recommended',
    files: ['**/*.{md,mdx,mdc,mdd}'],
    ...mdxPlugin.flat,
    processor: mdxPlugin.createRemarkProcessor({
      lintCodeBlocks: true, // Enable linting of code blocks
      languageMapper: {}    // Use default language mappings
    }),
    rules: {
      // MDX-specific rules from eslint-plugin-mdx
      // The remark-lint rules from .remarkrc.js will be automatically used
      'mdx/remark': 'error',
    },
    settings: {
      'mdx/code-blocks': true,  // Enable code block linting
      'mdx/language-mapper': {} // Use default mappings
    }
  },

  // Code blocks in MDX/MDC (optional - for stricter linting)
  {
    name: 'custom/mdx/code-blocks',
    files: ['**/*.{md,mdx,mdc,mdd}'],
    ...mdxPlugin.flatCodeBlocks,
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      }
    },
    rules: {
      ...mdxPlugin.flatCodeBlocks.rules,
      // Rules that make sense for documentation examples
      'no-var': 'error',
      'prefer-const': 'error',

      // Disable rules that don't make sense for isolated code examples
      'no-unused-vars': 'off',        // Examples often show declarations without usage
      'no-undef': 'off',               // Examples may reference external variables/functions
      'no-console': 'off',             // Console logs are common in examples
      'no-unreachable': 'off',         // Examples may show code patterns, not full logic
      'no-constant-condition': 'off',  // Examples may use simplified conditions
      'no-empty': 'off',               // Empty blocks may be placeholders in examples
      'prefer-rest-params': 'off',     // Examples may show older patterns
      'prefer-spread': 'off',          // Examples may demonstrate various approaches
      '@typescript-eslint/no-unused-vars': 'off',  // TypeScript variant
      'import/no-unresolved': 'off',   // Examples won't have real imports
      'no-redeclare': 'off',           // Multiple examples might reuse variable names
    }
  }
];
