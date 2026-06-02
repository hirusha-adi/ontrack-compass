(function () {
  const SOURCE = "ontrack-compass-bridge";

  function emitAuth(headers) {
    const token = headers["Auth-Token"] || headers["auth-token"];
    const username = headers["Username"] || headers["username"];
    if (token && username) {
      window.postMessage(
        { source: SOURCE, type: "AUTH_HEADERS", token, username },
        "*"
      );
    }
  }

  function headersFromInit(init) {
    const out = {};
    if (!init?.headers) return out;
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        out[k] = v;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([k, v]) => {
        out[k] = v;
      });
    } else {
      Object.assign(out, init.headers);
    }
    return out;
  }

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const init = args[1] || {};
    emitAuth(headersFromInit(init));
    return originalFetch.apply(this, args);
  };

  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const setRequestHeader = XHR.setRequestHeader;

  XHR.open = function (...args) {
    this._compassHeaders = {};
    return open.apply(this, args);
  };

  XHR.setRequestHeader = function (name, value) {
    this._compassHeaders = this._compassHeaders || {};
    this._compassHeaders[name] = value;
    return setRequestHeader.apply(this, arguments);
  };

  const send = XHR.send;
  XHR.send = function (...args) {
    if (this._compassHeaders) {
      emitAuth(this._compassHeaders);
    }
    return send.apply(this, args);
  };
})();
