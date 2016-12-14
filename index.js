'use strict';

let Module = require('module');

const SPECIAL_KEYS = ['globalVars'];

module.exports = remock;

function mockObject(obj) {
  let prevs = Object.create(null);
  Object.getOwnPropertyNames(obj).forEach(key => {
    prevs[key] = Object.getOwnPropertyDescriptor(obj, key);
  });

  return function restore() {
    Object.getOwnPropertyNames(obj).forEach(key => {
      let prev = prevs[key];
      if (!prev) {
        // Remove props that have been added
        delete obj[key];
      } else {
        // Restore props that have been mutated
        let desc = Object.getOwnPropertyDescriptor(obj, key);
        Object.keys(desc).some(field => {
          if (desc[field] !== prev[field]) {
            Object.defineProperty(obj, key, prev);
            return true;
          }
        });
      }
    });
  };
}

function remock(require) {
  if (typeof require !== 'function') {
    throw new TypeError('A require function must be provided to remock');
  }

  function clearCache() {
    // Copy out the current cache
    let cache = Object.assign({}, require.cache);

    // Remove everything from the cache
    Object.keys(require.cache).forEach(key => delete require.cache[key]);

    return function restore() {
      // Remove everything that has been cached as a result of 'fn'
      Object.keys(require.cache).forEach(key => delete require.cache[key]);

      // Restore cache to the previous state
      Object.assign(require.cache, cache);
    };
  }

  function populateCache(mocks) {
    Object.keys(mocks).forEach(id => {
      if (SPECIAL_KEYS.indexOf(id) >= 0)
        return;

      let path = require.resolve(id);
      let entry = new Module(path);
      entry.exports = mocks[id];
      require.cache[path] = entry;
    });
  }

  let restore;

  function start(mocks) {
    if (mocks && typeof mocks !== 'object')
      throw new TypeError('Invalid mock object provided to remock');

    if (restore)
      throw new Error('Mocking current active');

    // Clear the entire module cache
    let restoreCache = clearCache();
    let objectRestores = [];

    // Snapshot any objects in "globalVars"
    if (mocks && mocks.globalVars) {
      if (!Array.isArray(mocks.globalVars))
        throw new TypeError('"globalVars" key must be an array');

      objectRestores = mocks.globalVars.map(mockObject);
    }

    // Always snapshot the global object
    objectRestores.push(mockObject(global));

    // On completion, restore the module cache and object snapshots
    restore = () => {
      restoreCache();
      objectRestores.forEach(x => x());
    };

    // Populate the module cache with mocks
    if (mocks)
      populateCache(mocks);
  }

  function stop() {
    if (restore) {
      try {
        restore();
      } finally {
        restore = null;
      }
    }
  }

  function runMocks(mocks, fn) {
    return Promise.resolve().then(() => {
      if (!fn) {
        fn = mocks;
        mocks = null;
      }

      if (typeof fn !== 'function')
        throw new TypeError('Invalid callback function supplied to remock');

      start(mocks);
      return fn();
    }).then(
      x => { stop(); return x; },
      err => { stop(); throw err; }
    );
  }

  runMocks.start = start;
  runMocks.stop = stop;

  return runMocks;
}
