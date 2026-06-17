(function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const statusDot     = document.getElementById('statusDot');
  const statusText    = document.getElementById('statusText');
  const enabledToggle  = document.getElementById('enabledToggle');
  const vazirToggle    = document.getElementById('vazirToggle');
  const rescanBtn      = document.getElementById('rescanBtn');
  const rescanHint     = document.getElementById('rescanHint');
  const versionText    = document.getElementById('versionText');

  versionText.textContent = `v${api.runtime.getManifest().version}`;

  function storageGet(keys) {
    try {
      const ret = api.storage.local.get(keys);
      if (ret && typeof ret.then === 'function') return ret;
    } catch (e) { /* fall through */ }
    return new Promise((resolve) => api.storage.local.get(keys, resolve));
  }

  function storageSet(obj) {
    try {
      const ret = api.storage.local.set(obj);
      if (ret && typeof ret.then === 'function') return ret;
    } catch (e) { /* fall through */ }
    return new Promise((resolve) => api.storage.local.set(obj, resolve));
  }

  function queryActiveTab() {
    return new Promise((resolve) => {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0]));
    });
  }

  let activeTab = null;
  let isClaudeTab = false;

  async function refreshStatus() {
    activeTab = await queryActiveTab();
    isClaudeTab = !!(activeTab && /^https:\/\/claude\.ai\//.test(activeTab.url || ''));

    if (isClaudeTab) {
      statusDot.className = 'status-dot active';
      statusText.textContent = 'Active on this Claude.ai tab';
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Open claude.ai to use this extension';
    }
    rescanBtn.disabled = !isClaudeTab;
  }

  async function loadSettings() {
    const stored = await storageGet(['enabled', 'vazirFont']);
    enabledToggle.checked = stored.enabled !== false; // default true
    vazirToggle.checked   = stored.vazirFont === true; // default false
  }

  enabledToggle.addEventListener('change', () => {
    storageSet({ enabled: enabledToggle.checked });
  });

  vazirToggle.addEventListener('change', () => {
    storageSet({ vazirFont: vazirToggle.checked });
  });

  rescanBtn.addEventListener('click', async () => {
    if (!activeTab) return;
    rescanHint.textContent = '';
    try {
      await new Promise((resolve, reject) => {
        api.tabs.sendMessage(activeTab.id, { type: 'claude-rtl-fix:rescan' }, () => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve();
        });
      });
      rescanHint.textContent = 'Page re-scanned ✓';
    } catch (e) {
      rescanHint.textContent = 'Reload the Claude.ai tab and try again';
    }
    setTimeout(() => { rescanHint.textContent = ''; }, 2500);
  });

  refreshStatus();
  loadSettings();
})();
