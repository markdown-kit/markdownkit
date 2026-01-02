/**
 * Example plugin for mdkit autoformat
 * 
 * This shows how to create custom formatting rules for your specific needs.
 * 
 * To use this plugin:
 * 1. Copy this file to a plugins directory (e.g., ./my-plugins/)
 * 2. Run: mdkit autoformat --plugins ./my-plugins file.txt
 * 
 * You can create multiple plugin files in the same directory.
 */

export default {
  name: 'example-plugin',
  description: 'Example custom formatting rules',
  
  rules: [
    {
      name: 'jira-tickets',
      description: 'Convert JIRA ticket references to links',
      pattern: /\b([A-Z]+-\d+)\b/g,
      transform: (match) => `[${match[0]}](https://jira.company.com/browse/${match[0]})`
    },
    
    {
      name: 'github-issues',
      description: 'Convert GitHub issue references to links',
      pattern: /#(\d+)\b/g,
      transform: (match) => `[#${match[1]}](https://github.com/yourorg/yourrepo/issues/${match[1]})`
    },
    
    {
      name: 'priority-labels',
      description: 'Bold priority indicators',
      pattern: /^(PRIORITY|URGENT|BLOCKER):\s*(.*)$/,
      transform: (match) => `**${match[1]}:** ${match[2]}`
    },
    
    {
      name: 'date-formatting',
      description: 'Format dates consistently',
      pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
      transform: (match) => {
        // Convert MM/DD/YYYY to YYYY-MM-DD
        const [_, month, day, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    },
    
    {
      name: 'email-links',
      description: 'Convert email addresses to mailto links',
      pattern: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      transform: (match) => `[${match[0]}](mailto:${match[0]})`
    },
    
    {
      name: 'todo-checkboxes',
      description: 'Convert TODO items to markdown checkboxes',
      pattern: /^TODO:\s*(.+)$/,
      transform: (match) => `- [ ] ${match[1]}`
    },
    
    {
      name: 'done-checkboxes',
      description: 'Convert DONE items to checked markdown checkboxes',
      pattern: /^DONE:\s*(.+)$/,
      transform: (match) => `- [x] ${match[1]}`
    },
    
    {
      name: 'code-inline',
      description: 'Convert function names to inline code',
      pattern: /\b([a-z][a-zA-Z0-9]*)\(\)/g,
      transform: (match) => `\`${match[1]}()\``
    },
    
    {
      name: 'version-numbers',
      description: 'Bold version numbers',
      pattern: /\bv?(\d+\.\d+\.\d+)\b/g,
      transform: (match) => `**v${match[1]}**`
    },
    
    {
      name: 'status-badges',
      description: 'Convert status indicators to badges',
      pattern: /\[STATUS:\s*(ACTIVE|DEPRECATED|BETA|STABLE)\]/gi,
      transform: (match) => {
        const status = match[1].toUpperCase();
        const emoji = {
          'ACTIVE': '✅',
          'DEPRECATED': '⚠️',
          'BETA': '🚧',
          'STABLE': '🟢'
        };
        return `${emoji[status]} **${status}**`;
      }
    }
  ]
};

/**
 * ADVANCED: Multi-line rule example
 * 
 * For more complex transformations that need to look at multiple lines,
 * you can use the isMultiLine flag:
 * 
 * Example (uncomment to enable):
 * 
 * export const advancedRules = {
 *   name: 'advanced-plugin',
 *   rules: [
 *     {
 *       name: 'table-detection',
 *       description: 'Detect and format tables',
 *       isMultiLine: true,
 *       pattern: /^(\w+)\s*\|\s*(\w+)\s*\|\s*(\w+)$/gm,
 *       transform: (lines) => {
 *         // Custom logic to detect and format tables
 *         // This is called with the full text, not individual lines
 *         return lines; // Return transformed text
 *       }
 *     }
 *   ]
 * };
 */

/**
 * TIPS:
 * 
 * 1. Test your regex patterns carefully - they run on every line
 * 2. Use the 'g' flag for patterns that should match multiple times per line
 * 3. Order matters - rules are applied in sequence
 * 4. Keep transforms simple and fast
 * 5. Use descriptive names and descriptions for debugging
 * 
 * COMMON PATTERNS:
 * 
 * - Headings: /^(#{1,6})\s+(.+)$/
 * - Lists: /^[-*+]\s+(.+)$/
 * - Links: /\[([^\]]+)\]\(([^)]+)\)/
 * - Code: /`([^`]+)`/
 * - Bold: /\*\*([^*]+)\*\*/
 * - Italic: /_([^_]+)_/
 * - URLs: /https?:\/\/[^\s]+/
 */
