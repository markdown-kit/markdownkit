/**
 * Smart Typography Plugin for mdkit autoformat
 * 
 * Provides advanced typography rules for professional-looking markdown output.
 * Inspired by flowmark's typography features.
 * 
 * To use this plugin:
 * 1. Save this file to a plugins directory (e.g., ./plugins/)
 * 2. Run: mdkit autoformat --plugins ./plugins file.md
 */

export default {
  name: 'smart-typography',
  description: 'Advanced typography rules for professional output',
  
  rules: [
    {
      name: 'em-dash',
      description: 'Convert double hyphens to em dash',
      pattern: /(\w)--(\w)/g,
      transform: (match) => `${match[1]}—${match[2]}`
    },
    
    {
      name: 'en-dash-ranges',
      description: 'Convert hyphens in number ranges to en dash',
      pattern: /(\d+)-(\d+)/g,
      transform: (match) => `${match[1]}–${match[2]}`
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
    },
    
    {
      name: 'arrows',
      description: 'Convert arrow text to arrow symbols',
      pattern: /->/g,
      transform: () => '→'
    },
    
    {
      name: 'arrows-left',
      description: 'Convert left arrow text to arrow symbols',
      pattern: /<-/g,
      transform: () => '←'
    },
    
    {
      name: 'double-arrows',
      description: 'Convert double arrow text to arrow symbols',
      pattern: /=>/g,
      transform: () => '⇒'
    },
    
    {
      name: 'multiplication',
      description: 'Convert x between numbers to multiplication symbol',
      pattern: /(\d+)\s*x\s*(\d+)/gi,
      transform: (match) => `${match[1]} × ${match[2]}`
    },
    
    {
      name: 'fractions-half',
      description: 'Convert 1/2 to fraction symbol',
      pattern: /\b1\/2\b/g,
      transform: () => '½'
    },
    
    {
      name: 'fractions-quarter',
      description: 'Convert 1/4 to fraction symbol',
      pattern: /\b1\/4\b/g,
      transform: () => '¼'
    },
    
    {
      name: 'fractions-three-quarters',
      description: 'Convert 3/4 to fraction symbol',
      pattern: /\b3\/4\b/g,
      transform: () => '¾'
    }
  ]
};

/**
 * USAGE EXAMPLES:
 * 
 * Basic usage:
 *   mdkit autoformat --plugins ./plugins document.md
 * 
 * Combined with other features:
 *   mdkit autoformat --auto --plugins ./plugins document.md
 * 
 * TRANSFORMATIONS:
 * 
 * Before:                  After:
 * word--word               word—word
 * pages 10-20              pages 10–20
 * Product(TM)              Product™
 * Company(R)               Company®
 * Copyright (C) 2024       Copyright © 2024
 * A -> B                   A → B
 * B <- A                   B ← A
 * A => B                   A ⇒ B
 * 10 x 20                  10 × 20
 * 1/2 cup                  ½ cup
 * 1/4 inch                 ¼ inch
 * 3/4 done                 ¾ done
 */
