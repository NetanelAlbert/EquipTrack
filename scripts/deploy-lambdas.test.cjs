const test = require('node:test');
const assert = require('assert');
const {
  environmentVariablesEqual,
  lambdaConfigurationNeedsUpdate,
  getLambdaEnvironmentVariables,
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
        Environment: { Variables: { STAGE: 'dev', LAMBDA_HANDLER_KEY: 'getUsers' } },
      },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev', LAMBDA_HANDLER_KEY: 'getUsers' } }
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
        Environment: { Variables: { STAGE: 'dev', LAMBDA_HANDLER_KEY: 'getUsers' } },
      },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev', LAMBDA_HANDLER_KEY: 'getUsers' } }
    ),
    true
  );
});

test('lambdaConfigurationNeedsUpdate treats missing Environment as empty', () => {
  assert.strictEqual(
    lambdaConfigurationNeedsUpdate(
      { Timeout: 30, MemorySize: 256 },
      { timeout: 30, memorySize: 256, variables: { STAGE: 'dev', LAMBDA_HANDLER_KEY: 'getUsers' } }
    ),
    true
  );
});

test('getLambdaEnvironmentVariables includes LAMBDA_HANDLER_KEY', () => {
  const v = getLambdaEnvironmentVariables('getAllForms');
  assert.strictEqual(v.STAGE, process.env.STAGE || 'dev');
  assert.strictEqual(v.LAMBDA_HANDLER_KEY, 'getAllForms');
});
