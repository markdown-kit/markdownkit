/**
 * Smart Typography Plugin for mdfix autoformat
 */

export default {
  name: 'smart-typography',
  description: 'Advanced typography rules',
  
  rules: [
    {
      name: 'em-dash',
      description: 'Convert double hyphens to em dash',
      pattern: /(\w)--(\w)/g,
      transform: (match) => `${match[1]}—${match[2]}`
    },
    {
      name: 'arrows',
      description: 'Convert arrow text to arrow symbols',
      pattern: /->/g,
      transform: () => '→'
    },
    {
      name: 'trademark',
      description: 'Convert (TM) to trademark symbol',
      pattern: /\(TM\)/gi,
      transform: () => '™'
    },
    {
      name: 'registered',
      description: 'Convert (R) to registered symbol',
      pattern: /\(R\)/gi,
      transform: () => '®'
    },
    {
      name: 'copyright',
      description: 'Convert (C) to copyright symbol',
      pattern: /\(C\)/gi,
      transform: () => '©'
    }
  ]
};
