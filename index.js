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

  function mockModules(mocks, fn) {
    let restore;

    return new Promise(resolve => {
      if (!fn) {
        fn = mocks;
        mocks = null;
      }

      if (typeof fn !== 'function')
        throw new TypeError('Invalid callback function supplied to remock');

      if (mocks && typeof mocks !== 'object')
        throw new TypeError('Invalid mock object provided to remock');

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

      resolve();
    })
    .then(() => fn())
    .then(
      x => { restore(); return x; },
      err => { restore && restore(); throw err; }
    );
  }

  return mockModules;
}
