/* =============================================================
   EWU Portal Helper - Popup Script
   Settings UI Logic | Export | Import | Reset | Message Broadcast
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONSTANTS & DEFAULTS
     ----------------------------------------------------------- */
  const STORAGE_KEY = 'ewu_portal_helper_settings';
  const LOG_PREFIX = '[EWU Popup v2.1.0]';

  const DEFAULT_SETTINGS = {
    enabled: true,
    theme: 'dark',
    animations: true,
    toastNotifications: true,
    modules: {
      loginHelper: true,
      loginHelperAutoFill: true,
      loginHelperDelay: 300,
      loginHelperDebug: false,
      routineGenerator: true,
      routineCompact: false,
      routineShowLogo: true,
      routineBlueIntensity: 'medium',
      routineExportQuality: 'standard',
      offeredCoursesEnhancer: true,
      offeredCoursesColorLeft: true,
      offeredCoursesStickyHeader: true,
      offeredCoursesSearchBox: true,
      offeredCoursesSearchPlaceholder: 'Search by course or faculty...',
    },
  };


  /* -----------------------------------------------------------
     DOM REFERENCES
     ----------------------------------------------------------- */
  const els = {
    // General
    toggleEnabled:    document.getElementById('toggleEnabled'),
    toggleToast:       document.getElementById('toggleToast'),
    toggleAnimations: document.getElementById('toggleAnimations'),

    // Login Helper
    toggleLoginHelper: document.getElementById('toggleLoginHelper'),
    toggleAutoFill:    document.getElementById('toggleAutoFill'),
    inputDelay:        document.getElementById('inputDelay'),
    toggleDebug:       document.getElementById('toggleDebug'),
    rowAutoFill:       document.getElementById('rowAutoFill'),
    rowDelay:          document.getElementById('rowDelay'),
    rowDebug:          document.getElementById('rowDebug'),

    // Routine Generator
    toggleRoutine:     document.getElementById('toggleRoutine'),
    toggleCompact:     document.getElementById('toggleCompact'),
    toggleShowLogo:    document.getElementById('toggleShowLogo'),
    selectBlueIntensity: document.getElementById('selectBlueIntensity'),
    selectExportQuality: document.getElementById('selectExportQuality'),
    rowCompact:        document.getElementById('rowCompact'),
    rowShowLogo:       document.getElementById('rowShowLogo'),
    rowBlueIntensity:  document.getElementById('rowBlueIntensity'),
    rowExportQuality:   document.getElementById('rowExportQuality'),

    // Offered Courses Enhancer
    toggleOfferedCourses:    document.getElementById('toggleOfferedCourses'),
    toggleOCColorLeft:       document.getElementById('toggleOCColorLeft'),
    toggleOCStickyHeader:    document.getElementById('toggleOCStickyHeader'),
    toggleOCSearchBox:       document.getElementById('toggleOCSearchBox'),
    inputOCSearchPlaceholder: document.getElementById('inputOCSearchPlaceholder'),
    rowOCColorLeft:          document.getElementById('rowOCColorLeft'),
    rowOCStickyHeader:       document.getElementById('rowOCStickyHeader'),
    rowOCSearchBox:          document.getElementById('rowOCSearchBox'),
    rowOCSearchPlaceholder:  document.getElementById('rowOCSearchPlaceholder'),

    // Data management
    btnExport:  document.getElementById('btnExport'),
    btnImport:  document.getElementById('btnImport'),
    btnReset:   document.getElementById('btnReset'),
    fileImport: document.getElementById('fileImport'),

    // Toast
    toast: document.getElementById('toast'),
  };


  /* -----------------------------------------------------------
     UTILITY HELPERS
     ----------------------------------------------------------- */

  function log(...args) { console.log(LOG_PREFIX, ...args); }

  function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === 'object'
      ) {
        Object.assign(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  function showToast(message, duration) {
    duration = duration || 2000;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => { els.toast.classList.remove('show'); }, duration);
  }


  /* -----------------------------------------------------------
     SETTINGS I/O
     ----------------------------------------------------------- */

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result[STORAGE_KEY] || {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: settings }, resolve);
    });
  }

  function broadcastSettings(settings) {
    chrome.tabs.query({ url: 'https://portal.ewubd.edu/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EWU_SETTINGS_UPDATED',
          settings: settings,
        }).catch(() => {});
      }
    });
  }


  /* -----------------------------------------------------------
     UI RENDERING
     ----------------------------------------------------------- */

  function renderUI(settings) {
    // General
    els.toggleEnabled.checked = settings.enabled;
    els.toggleToast.checked = settings.toastNotifications !== false;
    els.toggleAnimations.checked = settings.animations;

    // Login Helper
    const mods = settings.modules || {};
    els.toggleLoginHelper.checked = !!mods.loginHelper;
    els.toggleAutoFill.checked = mods.loginHelperAutoFill !== false;
    els.inputDelay.value = typeof mods.loginHelperDelay === 'number' ? mods.loginHelperDelay : 300;
    els.toggleDebug.checked = !!mods.loginHelperDebug;
    updateLoginSubVisibility(!!mods.loginHelper);

    // Routine Generator
    els.toggleRoutine.checked = !!mods.routineGenerator;
    els.toggleCompact.checked = !!mods.routineCompact;
    els.toggleShowLogo.checked = mods.routineShowLogo !== false;
    els.selectBlueIntensity.value = mods.routineBlueIntensity || 'medium';
    els.selectExportQuality.value = mods.routineExportQuality || 'standard';
    updateRoutineSubVisibility(!!mods.routineGenerator);

    // Offered Courses Enhancer
    els.toggleOfferedCourses.checked = mods.offeredCoursesEnhancer !== false;
    els.toggleOCColorLeft.checked = mods.offeredCoursesColorLeft !== false;
    els.toggleOCStickyHeader.checked = mods.offeredCoursesStickyHeader !== false;
    els.toggleOCSearchBox.checked = mods.offeredCoursesSearchBox !== false;
    els.inputOCSearchPlaceholder.value = mods.offeredCoursesSearchPlaceholder || 'Search by course or faculty...';
    updateOCSubVisibility(mods.offeredCoursesEnhancer !== false);
  }

  function updateLoginSubVisibility(enabled) {
    const show = enabled;
    els.rowAutoFill.style.display = show ? 'flex' : 'none';
    els.rowDelay.style.display = show ? 'flex' : 'none';
    els.rowDebug.style.display = show ? 'flex' : 'none';
  }

  function updateRoutineSubVisibility(enabled) {
    const show = enabled;
    els.rowCompact.style.display = show ? 'flex' : 'none';
    els.rowShowLogo.style.display = show ? 'flex' : 'none';
    els.rowBlueIntensity.style.display = show ? 'flex' : 'none';
    els.rowExportQuality.style.display = show ? 'flex' : 'none';
  }

  function updateOCSubVisibility(enabled) {
    const show = enabled;
    els.rowOCColorLeft.style.display = show ? 'flex' : 'none';
    els.rowOCStickyHeader.style.display = show ? 'flex' : 'none';
    els.rowOCSearchBox.style.display = show ? 'flex' : 'none';
    els.rowOCSearchPlaceholder.style.display = show ? 'flex' : 'none';
  }


  /* -----------------------------------------------------------
     EVENT BINDING
     ----------------------------------------------------------- */

  function bindEvents() {

    /* ========== General ========== */

    els.toggleEnabled.addEventListener('change', async () => {
      const s = await loadSettings();
      s.enabled = els.toggleEnabled.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(s.enabled ? 'Extension enabled' : 'Extension disabled');
    });

    els.toggleToast.addEventListener('change', async () => {
      const s = await loadSettings();
      s.toastNotifications = els.toggleToast.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(s.toastNotifications ? 'Toasts enabled' : 'Toasts disabled');
    });

    els.toggleAnimations.addEventListener('change', async () => {
      const s = await loadSettings();
      s.animations = els.toggleAnimations.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(s.animations ? 'Animations enabled' : 'Animations disabled');
    });

    /* ========== Login Helper ========== */

    els.toggleLoginHelper.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.loginHelper = els.toggleLoginHelper.checked;
      await saveSettings(s); broadcastSettings(s);
      updateLoginSubVisibility(s.modules.loginHelper);
      showToast(s.modules.loginHelper ? 'Login Helper enabled' : 'Login Helper disabled');
    });

    els.toggleAutoFill.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.loginHelperAutoFill = els.toggleAutoFill.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(s.modules.loginHelperAutoFill ? 'Auto-fill enabled' : 'Auto-fill disabled');
    });

    let delayTimer = null;
    els.inputDelay.addEventListener('input', () => {
      clearTimeout(delayTimer);
      delayTimer = setTimeout(async () => {
        let v = parseInt(els.inputDelay.value, 10);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 10000) v = 10000;
        els.inputDelay.value = v;
        const s = await loadSettings();
        s.modules.loginHelperDelay = v;
        await saveSettings(s); broadcastSettings(s);
        showToast('Delay set to ' + v + 'ms');
      }, 500);
    });

    els.toggleDebug.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.loginHelperDebug = els.toggleDebug.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(s.modules.loginHelperDebug ? 'Debug on (check console)' : 'Debug off');
    });

    /* ========== Routine Generator ========== */

    els.toggleRoutine.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.routineGenerator = els.toggleRoutine.checked;
      await saveSettings(s); broadcastSettings(s);
      updateRoutineSubVisibility(s.modules.routineGenerator);
      showToast(s.modules.routineGenerator ? 'Routine Generator enabled' : 'Routine Generator disabled');
    });

    els.toggleCompact.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.routineCompact = els.toggleCompact.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(els.toggleCompact.checked ? 'Compact mode on' : 'Compact mode off');
    });

    els.toggleShowLogo.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.routineShowLogo = els.toggleShowLogo.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(els.toggleShowLogo.checked ? 'Logo shown' : 'Logo hidden');
    });

    els.selectBlueIntensity.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.routineBlueIntensity = els.selectBlueIntensity.value;
      await saveSettings(s); broadcastSettings(s);
      showToast('Blue theme: ' + els.selectBlueIntensity.value);
    });

    els.selectExportQuality.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.routineExportQuality = els.selectExportQuality.value;
      await saveSettings(s); broadcastSettings(s);
      showToast('Export quality: ' + els.selectExportQuality.value);
    });

    /* ========== Offered Courses Enhancer ========== */

    els.toggleOfferedCourses.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.offeredCoursesEnhancer = els.toggleOfferedCourses.checked;
      await saveSettings(s); broadcastSettings(s);
      updateOCSubVisibility(s.modules.offeredCoursesEnhancer);
      showToast(s.modules.offeredCoursesEnhancer ? 'Course Enhancer enabled' : 'Course Enhancer disabled');
    });

    els.toggleOCColorLeft.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.offeredCoursesColorLeft = els.toggleOCColorLeft.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(els.toggleOCColorLeft.checked ? 'Seat colours on' : 'Seat colours off');
    });

    els.toggleOCStickyHeader.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.offeredCoursesStickyHeader = els.toggleOCStickyHeader.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(els.toggleOCStickyHeader.checked ? 'Sticky header on' : 'Sticky header off');
    });

    els.toggleOCSearchBox.addEventListener('change', async () => {
      const s = await loadSettings();
      s.modules.offeredCoursesSearchBox = els.toggleOCSearchBox.checked;
      await saveSettings(s); broadcastSettings(s);
      showToast(els.toggleOCSearchBox.checked ? 'Search box on' : 'Search box off');
    });

    let searchPlaceholderTimer = null;
    els.inputOCSearchPlaceholder.addEventListener('input', () => {
      clearTimeout(searchPlaceholderTimer);
      searchPlaceholderTimer = setTimeout(async () => {
        const v = els.inputOCSearchPlaceholder.value.trim() || 'Search by course or faculty...';
        els.inputOCSearchPlaceholder.value = v;
        const s = await loadSettings();
        s.modules.offeredCoursesSearchPlaceholder = v;
        await saveSettings(s); broadcastSettings(s);
        showToast('Search placeholder updated');
      }, 500);
    });

    /* ========== Data Management ========== */

    els.btnExport.addEventListener('click', async () => {
      const s = await loadSettings();
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ewu-portal-helper-settings.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast('Settings exported');
    });

    els.btnImport.addEventListener('click', () => { els.fileImport.click(); });

    els.fileImport.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (typeof imported.enabled !== 'boolean') { showToast('Invalid settings file'); return; }
        const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), imported);
        await saveSettings(merged); broadcastSettings(merged);
        renderUI(merged);
        showToast('Settings imported');
      } catch (err) {
        showToast('Failed to import settings');
        console.error(LOG_PREFIX, 'Import error:', err);
      }
      els.fileImport.value = '';
    });

    els.btnReset.addEventListener('click', async () => {
      const defaults = structuredClone(DEFAULT_SETTINGS);
      await saveSettings(defaults); broadcastSettings(defaults);
      renderUI(defaults);
      showToast('Settings reset to default');
    });
  }


  /* -----------------------------------------------------------
     INIT
     ----------------------------------------------------------- */

  async function init() {
    log('Popup opened');
    const settings = await loadSettings();
    renderUI(settings);
    bindEvents();
    log('Popup ready');
  }

  init();

})();
