const {session, BrowserWindow} = require('electron');
const PERSISTNAME = 'persist:web-session';
/**
 * A class responsible for managing chrome web session.
 */
class SessionManager {

  constructor(windowManager) {
    this.wm = windowManager;  
  }

  start() {
    this._session = this.getSessionCookies();
    this._session.on('changed', this._cookieChanged.bind(this));
  }

  _cookieChanged(event, cookie, cause, removed) {
    var data = {
      cookie: cookie,
      cause: cause,
      removed: removed
    };
    this.wm.notifyAll('cookie-changed', data);
  }

  getSessionCookies() {
    var sis = session.fromPartition(PERSISTNAME);
    return sis.cookies;
  }

  getAllCookies() {
    return new Promise((resolve, reject) => {
      this._session.get({}, (error, cookies) => {
        if (error) {
          reject(error);
        } else {
          resolve(cookies);
        }
      });
    });
  }

  getDomainCookies(url) {
    return new Promise((resolve, reject) => {
      this._session.get({domain: url}, (error, cookies) => {
        if (error) {
          reject(error);
        } else {
          resolve(cookies);
        }
      });
    });
  }

  setCookie(cookie) {
    return new Promise((resolve, reject) => {
      this._session.set(cookie, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  removeCookie(url, name) {
    return new Promise(resolve => {
      this._session.remove(url, name, () => {
        resolve();
      });
    });
  }

  /**
   * Opens a new browser window for given URL so the user can
   * authenticate himself in the external service and the app will store
   * cookies from this session.
   * @param {String} url An URL to open
   */
  openWebBrowser(url) {
    const bw = new BrowserWindow({
      webPreferences: {
        partition: PERSISTNAME
      }
    });
    bw.loadURL(url);
  }

  handleRequest(win, data) {
    switch (data.action) {
      case 'get':
        if (data.type === 'all') {
          this._handleAllCookies(win, data.id);
        } else {
          this._handleDomainCookies(win, data.id, data.domain);
        }
      break;
      case 'set':
        this._handleSetCookie(win, data.id, data.cookie);
      break;
      case 'remove':
        this._handleRemoveCookie(win, data.id, data.cookie);
      break;
    }
  }

  _sendResponse(win, id, response) {
    win.send('cookie-session-response', id, response);
  }

  _sendResponseError(win, id, cause) {
    var response = {
      message: cause.message
    };
    win.send('cookie-session-response', id, response);
  }

  _handleAllCookies(win, id) {
    this.getAllCookies()
    .then(cookies => this._sendResponse(win, id, cookies))
    .catch(cause => this._sendResponseError(win, id, cause));
  }

  _handleDomainCookies(win, id, domain) {
    this.getDomainCookies(domain)
    .then(cookies => this._sendResponse(win, id, cookies))
    .catch(cause => this._sendResponseError(win, id, cause));
  }

  _handleSetCookie(win, id, cookie) {
    this.setCookie(cookie)
    .then(() => this._sendResponse(win, id))
    .catch(cause => this._sendResponseError(win, id, cause));
  }

  _handleRemoveCookie(win, id, cookie) {
    this.removeCookie(cookie.url, cookie.name)
    .then(() => this._sendResponse(win, id))
    .catch(cause => this._sendResponseError(win, id, cause));
  }
}

exports.SessionManager = SessionManager;
