'use strict';

const test = require('blue-tape');
const remock = require('../');

function fakeRequire() {
  function require() {}
  function resolve() {}
  require.cache = {};
  require.resolve = resolve;
  return require;
}

function rejects(assert, promise, type, msg) {
  return promise.then(() => {
    assert.fail(msg);
  }, err => {
    assert.throws(() => {
      throw err;
    }, type, msg);
  });
}

test('Package entry point', async t => {
  t.equals(typeof remock, 'function', 'remock exports a function');

  t.throws(() => {
    remock();
  }, TypeError, 'Calling remock with no argument throws an error');

  t.throws(() => {
    remock('askdfj');
  }, TypeError, 'Calling remock with a non-function throws an error');

  let mock = remock(fakeRequire());
  t.equals(typeof mock, 'function', 'remock returns a function');
});

test('Argument validation', async t => {
  let mock = remock(fakeRequire());
  t.equals(mock(() => {}).constructor, Promise, 'returns a promise');

  await rejects(t, mock(), TypeError, 'rejects if called without arguments');
  await rejects(t, mock(123), TypeError, 'rejects if called without a callback');
  await rejects(t, mock(123, () => {}), TypeError, 'rejects if called with an invalid mock object');
  await rejects(t, mock({ globalVars: 1 }), TypeError, 'rejects if globalVars is not an array');
  await rejects(t, mock({ globalVars: null }), TypeError, 'rejects if globalVars is not an array');
  await rejects(t, mock({ globalVars: undefined }), TypeError, 'rejects if globalVars is not an array');
});

test('Module cache', async t => {
  let fake = fakeRequire();
  let mock = remock(fake);

  await mock(() => { fake.cache.hendrix = 'jimi'; });
  t.deepEqual(fake.cache, {}, 'cache is restored to empty if previously empty');
});

test('Global snapshot', async t => {
  let mock = remock(fakeRequire());

  await mock(() => { global.woop = 'woop'; });
  t.equals('woop' in global, false, 'added global variables are removed');

  global.woop = 'woop';
  await mock(() => { global.woop = 'waaa'; });
  t.equals(global.woop, 'woop', 'mutated global vars are restored');
});

test('Object snapshots', async t => {
  let mock = remock(fakeRequire());
  let obj = {
    x: 1,
  };
  await mock({
    globalVars: [obj]
  }, () => {
    obj.x = 2;
    obj.y = 3;
  });
  t.equals(obj.x, 1, 'mutated object properties are restored');
  t.equals('y' in obj, false, 'added object properties are removed');
});
