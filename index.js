'use strict';

let Module = require('module');

module.exports = remock;

function remock(require) {

  if (typeof require !== 'function') {
    throw new TypeError('A require function must be provided to remock');
  }

  function clearCache() {
    // Copy out the current cache
    let cache = Object.assign({}, require.cache);

    // Remove everything from the cache
    Object.keys(require.cache).forEach(key => delete require.cache[key]);

    // Copy out enumerable global vars
    let globals = Object.create(null);
    Object.keys(global).forEach(key => {
      globals[key] = Object.getOwnPropertyDescriptor(global, key);
    });

    return function restore() {
      // Remove everything that has been cached as a result of 'fn'
      Object.keys(require.cache).forEach(key => delete require.cache[key]);

      // Restore cache to the previous state
      Object.assign(require.cache, cache);

      Object.keys(global).forEach(key => {
        let prev = globals[key];
        if (!prev) {
          // Remove enumerable global vars that have been added
          delete global[key];
        } else {
          // Restore enumerable global vars that have been mutated
          let desc = Object.getOwnPropertyDescriptor(global, key);
          Object.keys(desc).some(field => {
            if (desc[field] !== prev[field]) {
              Object.defineProperty(global, key, prev);
              return true;
            }
          });
        }
      });
    };
  }

  function populateCache(mocks) {
    Object.keys(mocks).forEach(id => {
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

      restore = clearCache();

      if (mocks)
        populateCache(mocks);

      resolve();

    }).then(() => {

      return fn();

    }).then(x => {

      restore();
      return x;

    }, err => {

      if (restore) restore();
      throw err;

    });
  }

  return mockModules;
}
