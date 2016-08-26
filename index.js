'use strict';

let Module = require('module');

const SPECIAL_KEYS = ['objects'];

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

      let restoreCache = clearCache();
      let objectRestores = [];

      if (mocks && mocks.objects) {
        if (!Array.isArray(mocks.objects))
          throw new TypeError('"objects" key must be an array');

        objectRestores = mocks.objects.map(mockObject);
      }

      objectRestores.push(mockObject(global));

      restore = () => {
        restoreCache();
        objectRestores.forEach(x => x());
      };

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
