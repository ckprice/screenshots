/* globals browser, catcher */
window.communication = (function () {
  let exports = {};

  let registeredFunctions = {};

  browser.runtime.onMessage.addListener(catcher.watchFunction((req, sender, sendResponse) => {
    if (! (req.funcName in registeredFunctions)) {
      console.error(`Received unknown internal message type ${req.funcName}`);
      sendResponse({type: "error", name: "Unknown message type"});
      return;
    }
    if (! Array.isArray(req.args)) {
      console.error("Received message with no .args list");
      sendResponse({type: "error", name: "No .args"});
      return;
    }
    let func = registeredFunctions[req.funcName];
    let result;
    try {
      result = func.apply(null, req.args);
    } catch (e) {
      console.error(`Error in ${req.funcName}:`, e);
      sendResponse({type: "error", name: e+""});
      return;
    }
    if (result && result.then) {
      result.then((concreteResult) => {
        sendResponse({type: "success", value: concreteResult});
      }, (errorResult) => {
        sendResponse({type: "error", name: errorResult+""});
      });
      return true;
    } else {
      sendResponse({type: "success", value: result});
    }
  }));

  exports.register = function (name, func) {
    registeredFunctions[name] = func;
  };

  /** Send a message to bootstrap.js
      Technically any worker can listen to this.  If the bootstrap wrapper is not in place, then this
      will *not* fail, and will return a value of exports.NO_BOOTSTRAP  */
  exports.sendToBootstrap = function (funcName, ...args) {
    return browser.runtime.sendMessage({funcName, args}).then((result) => {
      if (result.type === "success") {
        return result.value;
      } else {
        throw new Error(`Error in ${funcName}: ${result.name || 'unknown'}`);
      }
    }, (error) => {
      if (error && error.message === "Could not establish connection. Receiving end does not exist.") {
        return exports.NO_BOOTSTRAP;
      }
      throw error;
    });
  };

  // A singleton/sentinal (with a name):
  exports.NO_BOOTSTRAP = {name: "communication.NO_BOOTSTRAP"};

  return exports;
})();
