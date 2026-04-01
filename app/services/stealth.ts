/**
 * JS-level stealth evasions injected via page.addInitScript().
 * Complements Patchright's protocol-level patches (Runtime.enable fix,
 * Console API disabled, automation flags removed).
 *
 * Evasions sourced from puppeteer-extra-plugin-stealth.
 */

/** Realistic Chrome UA — strips "Headless" from the User-Agent string. */
export const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

export const stealthScript = `
  // Hide navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // Fake navigator.plugins (Chrome normally has 5)
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      plugins.refresh = () => {};
      return Object.setPrototypeOf(plugins, PluginArray.prototype);
    },
  });

  // Fake navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Spoof navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 4,
  });

  // Fix chrome.runtime to appear as a real Chrome browser
  if (!window.chrome) {
    Object.defineProperty(window, 'chrome', { value: {}, writable: true });
  }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: () => {},
      sendMessage: () => {},
    };
  }

  // Fake permissions query for notifications
  const originalQuery = window.Notification
    ? Notification.permission
    : undefined;
  const perm = originalQuery || 'default';
  const handler = {
    apply: function (target, thisArg, args) {
      const param = (args || [{}])[0];
      if (param && param.name === 'notifications') {
        return Promise.resolve({ state: perm });
      }
      return Reflect.apply(target, thisArg, args);
    },
  };
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query = new Proxy(
      navigator.permissions.query.bind(navigator.permissions),
      handler
    );
  }

  // Pass WebGL vendor/renderer check
  const getParameterProxyHandler = {
    apply: function (target, thisArg, args) {
      const param = args[0];
      // UNMASKED_VENDOR_WEBGL
      if (param === 0x9245) return 'Intel Inc.';
      // UNMASKED_RENDERER_WEBGL
      if (param === 0x9246) return 'Intel Iris OpenGL Engine';
      return Reflect.apply(target, thisArg, args);
    },
  };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const proto = Object.getPrototypeOf(gl);
      proto.getParameter = new Proxy(proto.getParameter, getParameterProxyHandler);
    }
  } catch (_) {}
`
