'use strict';
const { app } = require('@azure/functions');
const { createStore } = require('./store');
const { createAnalyzer } = require('./analyzer');
const { createHandler } = require('./handler');
const { createAuthenticator } = require('./auth');
const { createHttpAdapter } = require('./http');
const { createWorker } = require('./worker');
let runtime;
function getRuntime() {
  if (!runtime) {
    const store = createStore(), analyzer = createAnalyzer();
    runtime = { http: createHttpAdapter({ authenticate: createAuthenticator(), handler: createHandler({ store, analyzer }) }), worker: createWorker({ store, analyzer }) };
  }
  return runtime;
}