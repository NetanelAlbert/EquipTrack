const test = require('node:test');
const assert = require('assert');
const {
  environmentVariablesEqual,
  lambdaConfigurationNeedsUpdate,
} = require('./deploy-lambdas.js');

test('environmentVariablesEqual ignores key order', () => {
  assert.strictEqual(
    environmentVariablesEqual({ b: '2', a: '1' }, { a: '1', b: '2' }),
    true
  );
});

test('environmentVariablesEqual detects value changes', () => {
  assert.strictEqual(
    environmentVariablesEqual({ STAGE: 'dev' }, { STAGE: 'production' }),
    false
  );
});

test('lambdaConfigurationNeedsUpdate is false when timeout, memory, and env match', () => {
  assert.strictEqual(
    lambdaConfigurationNeedsUpdate(
      {
        Timeout: 30,
        MemorySize: 256,
        Environment: { Variables: { STAGE: 'dev' } },
      },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev' } }
    ),
    false
  );
});

test('lambdaConfigurationNeedsUpdate is true when timeout differs', () => {
  assert.strictEqual(
    lambdaConfigurationNeedsUpdate(
      {
        Timeout: 29,
        MemorySize: 256,
        Environment: { Variables: { STAGE: 'dev' } },
      },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev' } }
    ),
    true
  );
});

test('lambdaConfigurationNeedsUpdate treats missing Environment as empty', () => {
  assert.strictEqual(
    lambdaConfigurationNeedsUpdate(
      { Timeout: 30, MemorySize: 256 },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev' } }
    ),
    true
  );
});
