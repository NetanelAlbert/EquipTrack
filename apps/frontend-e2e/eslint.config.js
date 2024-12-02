const baseConfig = require('../../eslint.base.config.js');
const playwright = require('eslint-plugin-playwright');
const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,

  playwright.configs['flat/recommended'],

  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
];
