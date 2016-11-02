# remock

Module mocking for unit testing

## Install

```sh
npm install remock
```

## Why?

I wanted to develop unit tests for an application I was working on. I wanted to be able to:

- Mock part of the global variable environment and have the global environment automatically restored after the unit test.
- Bypass Node's module cache during a unit test.
- Mock modules during a unit test.

Also, I wanted to work within these constraints:

- The library should be more than async-friendly, it should be async-first.
- The library should be dead simple; it shouldn't introduce its own vocabulary.
- The library should only use public Node APIs and involve no stack-trace hackery.
- Libraries are better than frameworks.

I tried several different solutions and but wasn't happy with any of them.

## Usage

```js
/*

First, we'll get a mock function by calling remock with our local "require".

*/
'use strict';

const mock = require('remock')(require);

test('Testing 1, 2, 3', () => {

  /*

  We're going to mock the "request" module so that we don't hit the internet
  during our unit tests. Also, we're going to mock the Date.now function for
  the duration of the test.

  The mock function returns a Promise so it's compatible with Promise-aware
  testing libraries.

  The callback that we provide to the mock function can return a Promise, if
  it needs to do async stuff.

  */

  return mock({
    request: (url, callback) => { /* Mock */ },
    globalVars: [Date],
  }, () => {
    Date.now = function() { return 1; };
    let comments = require('../src/comments');
    return comments.postComment({}).then(() => {
      // Make some assertions
    });
  });

});
```

## API

### `remock(require)`

Returns a mocking function which uses the `require` argument to resolve module names. You should pass the module-local `require` variable here.

### `mock([mockSpec, ] callback)`

Mocks the module system using the provided `mockSpec` object and executes `callback`. The callback argument may return a promise. When that promise is resolved or rejected, the module system and global object are restored to their pre-mock state.

Returns a promise for the completion value of `callback`.

### Mock Specifications

The mock specification argument provided to the mock function must be an object. The keys of the object are module paths and the values are the mocked module exports objects.

```js
'use strict';

const assert = require('assert');
const mock = require('remock')(require);

mock({
  './local-module': {
    fn() { return 'local-module mock' },
  },
  pkg: function() {
    return 'pkg mock';
  },
  globalVars: [Date],
}, () => {
  // Mock `Date.now`. Since Date appears in the globalVars array, it will
  // be restored after this callback has completed.
  Date.now = () => 1;

  assert.equals(require('./local-module').fn(), 'local-module mock');
  assert.equals(require('pkg')(), 'pkg mock');
});
```

Keys with special semantics:

- `globalVars`: An array of objects which will be restored to their pre-mock state when the promise returned by the callback has been resolved or rejected.
