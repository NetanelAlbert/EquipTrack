const test = require('node:test');
const assert = require('assert');
const { buildPathsByKey } = require('./generate-sam-template.js');

test('buildPathsByKey merges methods on the same path', () => {
  const paths = buildPathsByKey({
    getA: { path: '/resource', method: 'GET' },
    postA: { path: '/resource', method: 'POST' },
  });
  assert.deepStrictEqual(Object.keys(paths['/resource']).sort(), ['get', 'post']);
  assert.strictEqual(paths['/resource'].get.handlerKey, 'getA');
  assert.strictEqual(paths['/resource'].post.handlerKey, 'postA');
});

test('buildPathsByKey rejects duplicate method on same path', () => {
  assert.throws(
    () =>
      buildPathsByKey({
        a: { path: '/resource', method: 'GET' },
        b: { path: '/resource', method: 'GET' },
      }),
    /Duplicate route GET \/resource/
  );
});
