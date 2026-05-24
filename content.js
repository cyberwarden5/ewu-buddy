/* =============================================================
   EWU Portal Helper v2.1.0 - Bug Fix Release
   Content Script
   ---------------------------------------------------------------
   Fixes:
     - Strict page detection (only 3 target pages)
     - Removed always-visible floating badge/panel
     - Toast notifications: top-right, glassmorphism, dedup
     - Routine button: better placement & white-blue style
     - PDF/Image export: proper capture inside modal
     - Offered Courses: full-field search, observer throttle
     - Settings: no more broken unicode escapes
     - Stability: no duplicate injections
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONFIGURATION
     ----------------------------------------------------------- */
  var CONFIG = {
    PORTAL_BASE: 'https://portal.ewubd.edu',
    LOG_PREFIX: '[EWU Portal Helper]',
    STORAGE_KEY: 'ewu_portal_helper_settings',
    VERSION: '2.1.0',
  };

  /* -----------------------------------------------------------
     DEFAULT SETTINGS
     ----------------------------------------------------------- */
  var DEFAULT_SETTINGS = {
    enabled: true,
    theme: 'dark',
    animations: true,
    toastNotifications: true,
    stickyHeader: true,
    compactMode: false,
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
     STRICT PAGE DETECTION (path-only, no title/dom fallback)
     Allowed: /, /Home/ClassSchedule, /Home/OfferedCoursesStudent
     ----------------------------------------------------------- */
  var ALLOWED_PATHS = [
    { path: '/',               id: 'login',          label: 'Login Page' },
    { path: '/Account/Login',   id: 'login',          label: 'Login Page' },
    { path: '/account/login',   id: 'login',          label: 'Login Page' },
    { path: '/Home/ClassSchedule',           id: 'classSchedule',   label: 'My Class Schedule' },
    { path: '/home/classschedule',           id: 'classSchedule',   label: 'My Class Schedule' },
    { path: '/Home/OfferedCoursesStudent',   id: 'offeredCourses',  label: 'Offered Courses' },
    { path: '/home/offeredcoursesstudent',   id: 'offeredCourses',  label: 'Offered Courses' },
  ];

  function detectPage() {
    var pn = location.pathname;
    for (var i = 0; i < ALLOWED_PATHS.length; i++) {
      var ap = ALLOWED_PATHS[i];
      if (pn === ap.path || pn.toLowerCase() === ap.path.toLowerCase()) {
        return { id: ap.id, label: ap.label };
      }
      // For root path "/" also accept it without query/hash
      if (ap.path === '/' && (pn === '/' || pn === '')) {
        return { id: ap.id, label: ap.label };
      }
    }
    return null; // null = not a target page, extension stays silent
  }


  /* ===========================================================
     UTILITY HELPERS
     =========================================================== */

  function safeQuery(sel) {
    try { return document.querySelector(sel) || null; }
    catch (_) { return null; }
  }

  function safeQueryAll(sel) {
    try { return document.querySelectorAll(sel) || []; }
    catch (_) { return []; }
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(CONFIG.LOG_PREFIX);
    console.log.apply(console, args);
  }

  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(CONFIG.LOG_PREFIX);
    console.warn.apply(console, args);
  }

  var _debugEnabled = false;
  function debugLog() {
    if (_debugEnabled) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(CONFIG.LOG_PREFIX, '[DEBUG]');
      console.log.apply(console, args);
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }


  /* ===========================================================
     TOAST NOTIFICATION SYSTEM
     Top-right, glassmorphism, dedup, auto-hide
     =========================================================== */

  var Toast = {
    _container: null,
    _lastMessages: {},  // message -> timestamp for dedup

    _ensureContainer: function () {
      if (this._container) return;
      var el = document.createElement('div');
      el.id = 'ewu-toast-container';
      document.body.appendChild(el);
      this._container = el;
    },

    show: function (message, type, duration) {
      type = type || 'info';
      duration = duration || 3000;
      if (!_settings || !_settings.toastNotifications) return;

      // Dedup: skip if same message shown in last 4 seconds
      var now = Date.now();
      var lastTime = this._lastMessages[message];
      if (lastTime && (now - lastTime) < 4000) return;
      this._lastMessages[message] = now;

      // Cleanup old entries
      var keys = Object.keys(this._lastMessages);
      for (var k = 0; k < keys.length; k++) {
        if (now - this._lastMessages[keys[k]] > 10000) {
          delete this._lastMessages[keys[k]];
        }
      }

      this._ensureContainer();

      var toast = document.createElement('div');
      toast.className = 'ewu-toast-item ewu-toast-' + type;

      var icons = {
        success: '\u2705',
        error: '\u274C',
        warning: '\u26A0\uFE0F',
        info: '\u2139\uFE0F'
      };
      toast.innerHTML =
        '<span class="ewu-toast-icon">' + (icons[type] || icons.info) + '</span>' +
        '<span class="ewu-toast-text">' + escapeHTML(message) + '</span>';

      this._container.appendChild(toast);

      // Trigger slide-in animation
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          toast.classList.add('ewu-toast-visible');
        });
      });

      // Auto-hide with fade-out
      setTimeout(function () {
        toast.classList.remove('ewu-toast-visible');
        toast.classList.add('ewu-toast-exit');
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
      }, duration);
    },
  };


  /* ===========================================================
     SETTINGS MANAGEMENT
     =========================================================== */

  var _settings = null;

  function loadSettings() {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        var parsed = stored ? JSON.parse(stored) : {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), parsed));
        return;
      }
      chrome.storage.local.get(CONFIG.STORAGE_KEY, function (result) {
        var stored = result[CONFIG.STORAGE_KEY] || {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
        resolve();
        return;
      }
      chrome.storage.local.set({ ewu_portal_helper_settings: settings }, resolve);
    });
  }

  function deepMerge(target, source) {
    for (var key in source) {
      if (!source.hasOwnProperty(key)) continue;
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


  /* ===========================================================
     ANIMATION / THEME CLASS MANAGEMENT
     =========================================================== */

  function applyBodyClasses(settings) {
    document.body.classList.toggle('ewu-no-animations', !settings.animations);
  }


  /* ===========================================================
     LOGIN HELPER MODULE
     =========================================================== */

  var LoginHelperModule = {
    _hasRun: false,

    init: async function (settings) {
      if (this._hasRun) return;
      var mods = settings.modules || {};
      _debugEnabled = !!mods.loginHelperDebug;
      debugLog('Login Helper: checking...');

      // Detect login page by DOM
      if (!safeQuery('#loginform') && !safeQuery('#lblcaptchaAnswer') && !safeQuery('#username')) {
        debugLog('Not a login page');
        return;
      }

      // Find sum inputs
      var fi = safeQuery('input[name="FirstNo"]'), si = safeQuery('input[name="SecondNo"]');
      var firstRaw, secondRaw;
      if (fi && si) {
        firstRaw = fi.getAttribute('value');
        secondRaw = si.getAttribute('value');
      } else {
        var fl = safeQuery('#lblFirstNo'), sl = safeQuery('#lblSecondNo');
        if (!fl || !sl) { debugLog('Sum not found'); Toast.show('Sum question not found', 'error'); return; }
        firstRaw = fl.textContent.trim();
        secondRaw = sl.textContent.trim();
      }

      var a = parseInt(firstRaw, 10), b = parseInt(secondRaw, 10);
      if (isNaN(a) || isNaN(b)) { debugLog('Parse error'); Toast.show('Could not parse sum', 'error'); return; }
      var sum = a + b;

      var el = safeQuery('#lblcaptchaAnswer') || safeQuery('input[name="Answer"]');
      if (!el) { debugLog('Answer field missing'); Toast.show('Answer field not found', 'error'); return; }

      this._hasRun = true;

      if (mods.loginHelperAutoFill !== false) {
        var delay = typeof mods.loginHelperDelay === 'number' ? Math.max(0, mods.loginHelperDelay) : 300;
        setTimeout(function () {
          try {
            el.value = sum;
            var evts = ['focus', 'input', 'change', 'keyup', 'blur'];
            for (var i = 0; i < evts.length; i++) {
              el.dispatchEvent(new Event(evts[i], { bubbles: true, cancelable: evts[i] !== 'blur' && evts[i] !== 'focus' }));
            }
            el.classList.add('ewu-lh-filled');
            setTimeout(function () { el.classList.remove('ewu-lh-filled'); }, 1500);
            debugLog('Sum filled:', sum);
            Toast.show('Sum filled: ' + sum, 'success');
          } catch (_) {
            debugLog('Fill failed');
            Toast.show('Failed to fill sum', 'error');
          }
        }, delay);
      } else {
        debugLog('Sum (manual):', sum);
        Toast.show('Captcha answer: ' + sum, 'info');
      }
    },

    reset: function () { this._hasRun = false; },
  };


  /* ===========================================================
     ROUTINE GENERATOR MODULE
     =========================================================== */

  var RoutineGeneratorModule = {
    DAY_ORDER: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    DAY_MAP: { A: 'Saturday', S: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', F: 'Friday' },
    LOGO_URL: 'https://portal.ewubd.edu/Assets/img/logonn.png',
    API_KW: 'GetSemesterStudentWiseAdvisingCourseListStudent',

    _apiData: null, _tableReady: false, _hooksInstalled: false,
    _observer: null, _modalOpen: false, _currentOpts: null,

    init: async function (settings) {
      var mods = settings.modules || {};
      _debugEnabled = _debugEnabled || !!mods.loginHelperDebug;
      if (location.pathname.toLowerCase().indexOf('/home/classschedule') === -1 &&
          !safeQuery('[ng-controller="ClassScheduleController"]')) return;

      console.log('[EWU Helper][Routine] Class schedule page detected');
      log('Routine Generator activating');
      debugLog('Routine: active');
      this._hookAPI();
      this._watchTable();
      this._injectButton();
      if (this._apiData || this._tableReady) { this._updateBtn(true); debugLog('Routine: data ready'); }
    },

    _hookAPI: function () {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;
      var self = this;

      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try { var d = await res.clone().json(); self._apiData = d; log('Schedule API captured'); self._updateBtn(true); } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) { this._ewu_url = url; return origOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_url && this._ewu_url.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () { try { self._apiData = JSON.parse(xhr.responseText); self._updateBtn(true); } catch (e) {} });
        }
        return origSend.apply(this, arguments);
      };
    },

    _watchTable: function () {
      var container = safeQuery('[ng-show="SemesterAdvData.length"]');
      if (!container) { console.log('[EWU Helper][Routine] Schedule table container not found'); return; }
      console.log('[EWU Helper][Routine] Schedule table detected');
      var self = this;
      this._observer = new MutationObserver(function () {
        if (!self._tableReady) {
          self._tableReady = true;
          self._updateBtn(true);
        }
      });
      this._observer.observe(container, { childList: true, subtree: true });
      if (container.querySelectorAll('table tr').length > 2) { this._tableReady = true; this._updateBtn(true); }
    },

    _injectButton: function () {
      if (safeQuery('#ewu-rg-btn-generate')) return;
      // Place button directly above the schedule table
      var scheduleDiv = safeQuery('[ng-show="SemesterAdvData.length"]');
      if (!scheduleDiv) { console.log('[EWU Helper][Routine] Cannot inject button - schedule table not found'); return; }

      var wrapper = document.createElement('div');
      wrapper.id = 'ewu-rg-btn-wrapper';
      wrapper.style.cssText = 'text-align:right;margin-bottom:16px;margin-top:12px;';

      var btn = document.createElement('button');
      btn.id = 'ewu-rg-btn-generate';
      btn.type = 'button';
      btn.className = 'ewu-rg-inject-btn';
      btn.disabled = true;
      btn.innerHTML = 'Generate Routine';

      wrapper.appendChild(btn);
      // Insert directly after the schedule table
      scheduleDiv.parentNode.insertBefore(wrapper, scheduleDiv.nextSibling);
      console.log('[EWU Helper][Routine] Generate Routine button injected');

      var self = this;
      btn.addEventListener('click', function () { self._onGenerate(); });
    },

    _updateBtn: function (on) {
      var btn = safeQuery('#ewu-rg-btn-generate');
      if (!btn) return;
      btn.disabled = !on;
      btn.classList.toggle('ewu-rg-btn-ready', on);
    },

    _extractCourses: function () {
      var courses = null;
      if (this._apiData) {
        var items = this._apiData;
        if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
        if (Array.isArray(items)) {
          courses = [];
          for (var i = 0; i < items.length; i++) {
            var c = items[i];
            if (c && c.CourseCode && c.CourseCode.trim()) {
              courses.push({
                courseCode: c.CourseCode.trim(),
                sectionName: c.SectionName,
                timeSlotName: (c.TimeSlotName || '').trim(),
                roomName: (c.RoomName || '').trim()
              });
            }
          }
          if (courses.length > 0) return courses;
        }
      }
      // Fallback: parse from DOM table
      var rows = safeQueryAll('table.table-striped tr');
      if (rows.length >= 2) {
        courses = [];
        for (var j = 1; j < rows.length; j++) {
          var cells = rows[j].querySelectorAll('td');
          if (cells.length >= 6) {
            var code = (cells[1] || {}).textContent;
            if (code && code.trim()) {
              courses.push({
                courseCode: code.trim(),
                sectionName: (cells[2] || {}).textContent || '',
                timeSlotName: (cells[4] || {}).textContent || '',
                roomName: (cells[5] || {}).textContent || ''
              });
            }
          }
        }
        if (courses.length > 0) return courses;
      }
      return [];
    },

    _parseSlot: function (ts) {
      if (!ts) return null;
      var m = ts.trim().match(/^([A-Z]+)\s+([\d:]+(?:AM|PM))-([\d:]+(?:AM|PM))$/i);
      if (!m) return null;
      var self = this, days = [];
      for (var i = 0; i < m[1].length; i++) { if (self.DAY_MAP[m[1][i]]) days.push(self.DAY_MAP[m[1][i]]); }
      if (!days.length) return null;
      function toMin(t) {
        var p = t.match(/(\d+):(\d+)(AM|PM)/i);
        if (!p) return 0;
        var h = parseInt(p[1], 10);
        if (p[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (p[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + parseInt(p[2], 10);
      }
      return { days: days, startTime: m[2].toUpperCase(), endTime: m[3].toUpperCase(), sortTime: toMin(m[2]) };
    },

    _getSemesterName: function () {
      var sel = safeQuery('select[data-ng-model="selectedSemesterId"]');
      if (sel && sel.selectedIndex > 0 && sel.options[sel.selectedIndex]) {
        var t = sel.options[sel.selectedIndex].text.trim();
        if (t && t !== 'Select Semester') return t;
      }
      return '';
    },

    _onGenerate: async function () {
      this._updateBtn(false);
      var courses = this._extractCourses();
      if (!courses.length) {
        Toast.show('No course data found', 'error');
        this._updateBtn(this._tableReady || !!this._apiData);
        return;
      }

      console.log('[EWU Helper][Routine] Routine modal opening');
      var semName = this._getSemesterName();
      var mods = await loadSettings().then(function (s) { return s.modules || {}; });
      this._currentOpts = {
        compact: !!mods.routineCompact,
        showLogo: mods.routineShowLogo !== false,
        blueIntensity: mods.routineBlueIntensity || 'medium',
        exportQuality: mods.routineExportQuality || 'standard'
      };

      var html = this._buildRoutine(courses, semName, this._currentOpts);
      this._renderModal(html);
      debugLog('Routine: ' + courses.length + ' courses');
      this._updateBtn(true);
    },

    _buildRoutine: function (courses, semesterName, opts) {
      if (!courses || !courses.length) return '<div class="ewu-rt-empty">No courses found.</div>';
      var compact = !!opts.compact, showLogo = opts.showLogo !== false, intensity = opts.blueIntensity || 'medium';
      var pad = compact ? 4 : 8, fs = compact ? '10px' : '11px';
      var self = this;

      var sorted = courses.slice().sort(function (a, b) {
        var c = a.courseCode.localeCompare(b.courseCode);
        return c !== 0 ? c : (a.sectionName || 0) - (b.sectionName || 0);
      });

      var dayMap = {};
      this.DAY_ORDER.forEach(function (d) { dayMap[d] = []; });
      for (var ci = 0; ci < sorted.length; ci++) {
        var parsed = self._parseSlot(sorted[ci].timeSlotName);
        if (!parsed) continue;
        for (var di = 0; di < parsed.days.length; di++) {
          dayMap[parsed.days[di]].push({
            courseCode: sorted[ci].courseCode,
            sectionName: sorted[ci].sectionName,
            roomName: sorted[ci].roomName,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            sortTime: parsed.sortTime
          });
        }
      }
      this.DAY_ORDER.forEach(function (d) { dayMap[d].sort(function (a, b) { return a.sortTime - b.sortTime; }); });

      var themes = {
        light: { hb: '#D6E4F0', hf: '#1A365D', db: '#EDF2F7', bd: '#B0C4DE' },
        medium: { hb: '#1A73E8', hf: '#FFF', db: '#E8F0FE', bd: '#4285F4' },
        strong: { hb: '#0D47A1', hf: '#FFF', db: '#E3F2FD', bd: '#1565C0' }
      };
      var th = themes[intensity] || themes.medium, bdr = th.bd;

      var h = '<div class="ewu-rt-container" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">';
      h += '<div style="text-align:center;margin-bottom:16px;">';
      if (showLogo) h += '<img src="' + this.LOGO_URL + '" crossorigin="anonymous" style="max-height:60px;margin-bottom:8px;" onerror="this.style.display=\'none\'" />';
      h += '<h2 style="margin:0;font-size:18px;font-weight:700;color:' + th.hb + ';">East West University</h2>';
      h += '<h3 style="margin:4px 0 2px;font-size:15px;font-weight:600;color:#333;">Class Routine</h3>';
      if (semesterName) h += '<p style="margin:0;font-size:12px;color:#666;">' + escapeHTML(semesterName) + '</p>';
      h += '</div>';

      h += '<table class="ewu-rt-table" style="width:100%;border-collapse:collapse;font-size:' + (compact ? '11px' : '13px') + ';border:2px solid ' + bdr + ';">';
      h += '<thead><tr><th style="background:' + th.hb + ';color:' + th.hf + ';padding:' + pad + 'px 10px;border:1px solid ' + bdr + ';font-weight:600;text-align:center;min-width:80px;">Day</th>';
      for (var si = 0; si < sorted.length; si++) {
        h += '<th style="background:' + th.hb + ';color:' + th.hf + ';padding:' + pad + 'px 8px;border:1px solid ' + bdr + ';font-weight:600;text-align:center;white-space:nowrap;">' + escapeHTML(sorted[si].courseCode);
        if (sorted[si].sectionName !== undefined && sorted[si].sectionName !== null) h += ' (' + escapeHTML(String(sorted[si].sectionName)) + ')';
        h += '</th>';
      }
      h += '</tr></thead><tbody>';

      for (var di2 = 0; di2 < this.DAY_ORDER.length; di2++) {
        var day = this.DAY_ORDER[di2];
        h += '<tr><td style="background:' + th.db + ';padding:' + pad + 'px 10px;border:1px solid ' + bdr + ';font-weight:600;text-align:center;white-space:nowrap;">' + day + '</td>';
        for (var sci = 0; sci < sorted.length; sci++) {
          var entry = null;
          for (var ei = 0; ei < dayMap[day].length; ei++) {
            if (dayMap[day][ei].courseCode === sorted[sci].courseCode && dayMap[day][ei].sectionName === sorted[sci].sectionName) {
              entry = dayMap[day][ei]; break;
            }
          }
          if (entry) {
            h += '<td style="background:#FFF;padding:' + pad + 'px 8px;border:1px solid ' + bdr + ';text-align:center;vertical-align:middle;">';
            h += '<div style="font-size:' + fs + ';color:#444;margin-bottom:2px;">' + escapeHTML(entry.roomName) + '</div>';
            h += '<div style="font-size:' + fs + ';color:#1A73E8;font-weight:600;">' + entry.startTime + ' - ' + entry.endTime + '</div></td>';
          } else {
            h += '<td style="background:#FFF;padding:' + pad + 'px;border:1px solid ' + bdr + ';"></td>';
          }
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      h += '<div style="text-align:center;margin-top:12px;font-size:10px;color:#999;">Generated by EWU Portal Helper v' + CONFIG.VERSION + '</div></div>';
      return h;
    },

    _renderModal: function (html) {
      var old = safeQuery('#ewu-rg-modal'); if (old) old.remove();
      var modal = document.createElement('div');
      modal.id = 'ewu-rg-modal';
      modal.className = 'ewu-rg-modal';
      modal.innerHTML =
        '<div class="ewu-rg-overlay"></div>' +
        '<div class="ewu-rg-content">' +
          '<div class="ewu-rg-toolbar">' +
            '<div class="ewu-rg-toolbar-title">Class Routine Preview</div>' +
            '<div class="ewu-rg-toolbar-actions">' +
              '<button class="ewu-rg-btn ewu-rg-btn-pdf" id="ewu-rg-pdf-btn" title="Save as PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF</button>' +
              '<button class="ewu-rg-btn ewu-rg-btn-img" id="ewu-rg-img-btn" title="Save as Image"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</button>' +
              '<button class="ewu-rg-btn ewu-rg-btn-close" id="ewu-rg-close-btn" title="Close">&times;</button>' +
            '</div>' +
          '</div>' +
          '<div class="ewu-rg-body" id="ewu-rg-preview">' + html + '</div>' +
        '</div>' +
        '<div class="ewu-rg-loading" id="ewu-rg-loading" style="display:none;"><div class="ewu-rg-spinner"></div><span>Exporting...</span></div>';

      document.body.appendChild(modal);
      this._modalOpen = true;
      var self = this;
      modal.querySelector('#ewu-rg-close-btn').addEventListener('click', function () { self._closeModal(); });
      modal.querySelector('.ewu-rg-overlay').addEventListener('click', function () { self._closeModal(); });
      modal.querySelector('#ewu-rg-pdf-btn').addEventListener('click', function () { self._exportPDF(); });
      modal.querySelector('#ewu-rg-img-btn').addEventListener('click', function () { self._exportImage(); });
      this._escHandler = function (e) { if (e.key === 'Escape' && self._modalOpen) self._closeModal(); };
      document.addEventListener('keydown', this._escHandler);
      requestAnimationFrame(function () { modal.classList.add('ewu-rg-modal-open'); });
      Toast.show('Routine generated', 'success');
    },

    _closeModal: function () {
      var m = safeQuery('#ewu-rg-modal'); if (!m) return;
      m.classList.remove('ewu-rg-modal-open');
      var self = this;
      setTimeout(function () { if (m.parentNode) m.remove(); self._modalOpen = false; }, 300);
      if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
    },

    _loadLibs: async function () {
      if (window.html2canvas && window.jspdf) {
        console.log('[EWU Helper][Routine] Libraries already loaded (html2canvas, jsPDF)');
        return true;
      }
      function load(url) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = url;
          s.onload = res;
          s.onerror = function () { rej(new Error('Failed to load ' + url)); };
          (document.head || document.documentElement).appendChild(s);
        });
      }
      try {
        var base = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime.getURL('lib/') : '';
        console.log('[EWU Helper][Routine] Loading libraries from:', base);
        await load(base + 'html2canvas.min.js');
        console.log('[EWU Helper][Routine] html2canvas loaded successfully');
        await load(base + 'jspdf.umd.min.js');
        console.log('[EWU Helper][Routine] jsPDF loaded successfully');
        return true;
      } catch (e) {
        console.log('[EWU Helper][Routine] Library load failed:', e.message);
        warn('Library load failed:', e.message);
        return false;
      }
    },

    _exportPDF: async function () {
      console.log('[EWU Helper][Routine] PDF export started');
      this._showLoad(true);
      try {
        var loaded = await this._loadLibs();
        if (!loaded) {
          console.log('[EWU Helper][Routine] Libraries unavailable, using print fallback');
          // Fallback: open print dialog
          var prev = safeQuery('#ewu-rg-preview');
          if (prev) {
            var w = window.open('', '_blank');
            if (w) {
              w.document.write('<html><head><meta charset="UTF-8"><title>EWU Class Routine</title></head><body>' + prev.innerHTML + '</body></html>');
              w.document.close();
              w.print();
            }
          }
          this._showLoad(false);
          Toast.show('Print dialog opened (libs unavailable)', 'warning');
          return;
        }

        var prev = safeQuery('#ewu-rg-preview');
        if (!prev) { console.log('[EWU Helper][Routine] Preview element not found'); this._showLoad(false); Toast.show('Preview not found', 'error'); return; }
        
        console.log('[EWU Helper][Routine] Export target element found, size:', prev.scrollWidth, 'x', prev.scrollHeight);

        // Hide overlay during capture for clean render
        var overlay = safeQuery('.ewu-rg-overlay');
        var loading = safeQuery('.ewu-rg-loading');
        if (overlay) overlay.style.display = 'none';
        if (loading) loading.style.display = 'none';

        console.log('[EWU Helper][Routine] Capturing canvas with html2canvas');
        var scale = (this._currentOpts && this._currentOpts.exportQuality === 'high') ? 3 : 2;
        var canvas = await window.html2canvas(prev, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          windowWidth: Math.min(prev.scrollWidth, 1200),
          windowHeight: prev.scrollHeight,
        });

        // Restore overlay
        if (overlay) overlay.style.display = '';
        if (loading) loading.style.display = 'none';

        console.log('[EWU Helper][Routine] Canvas generated, size:', canvas.width, 'x', canvas.height);

        // A4 PDF with proper fit-to-page scaling
        var orient = canvas.width > canvas.height ? 'landscape' : 'portrait';
        var pdf = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        var margin = 10, uw = pw - margin * 2, uh = ph - margin * 2;
        var ratio = Math.min(uw / canvas.width, uh / canvas.height);
        var sw = canvas.width * ratio, sh = canvas.height * ratio;
        var xOff = (pw - sw) / 2, yOff = (ph - sh) / 2;
        console.log('[EWU Helper][Routine] Adding image to PDF, orientation:', orient);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOff, yOff, sw, sh, undefined, 'FAST');
        pdf.save('EWU_Class_Routine.pdf');
        console.log('[EWU Helper][Routine] PDF export successful');
        Toast.show('PDF exported successfully', 'success');
      } catch (e) {
        console.log('[EWU Helper][Routine] PDF export failed:', e.message, e);
        warn('PDF export failed:', e);
        Toast.show('PDF export failed: ' + (e.message || 'Unknown error'), 'error');
      }
      this._showLoad(false);
    },

    _exportImage: async function () {
      console.log('[EWU Helper][Routine] Image export started');
      this._showLoad(true);
      try {
        if (!await this._loadLibs()) {
          console.log('[EWU Helper][Routine] Libraries unavailable for image export');
          Toast.show('Export libraries not available', 'error');
          this._showLoad(false);
          return;
        }
        var prev = safeQuery('#ewu-rg-preview');
        if (!prev) { console.log('[EWU Helper][Routine] Preview element not found'); this._showLoad(false); Toast.show('Preview not found', 'error'); return; }

        console.log('[EWU Helper][Routine] Export target element found, size:', prev.scrollWidth, 'x', prev.scrollHeight);

        // Hide overlay during capture
        var overlay = safeQuery('.ewu-rg-overlay');
        var loading = safeQuery('.ewu-rg-loading');
        if (overlay) overlay.style.display = 'none';
        if (loading) loading.style.display = 'none';

        console.log('[EWU Helper][Routine] Capturing canvas with html2canvas');
        var scale = (this._currentOpts && this._currentOpts.exportQuality === 'high') ? 3 : 2;
        var canvas = await window.html2canvas(prev, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          windowWidth: Math.min(prev.scrollWidth, 1200),
          windowHeight: prev.scrollHeight,
        });

        // Restore overlay
        if (overlay) overlay.style.display = '';
        if (loading) loading.style.display = 'none';

        console.log('[EWU Helper][Routine] Canvas generated, size:', canvas.width, 'x', canvas.height);

        canvas.toBlob(function (blob) {
          if (!blob) { console.log('[EWU Helper][Routine] Image blob generation failed'); Toast.show('Image generation failed', 'error'); return; }
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'EWU_Class_Routine.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          console.log('[EWU Helper][Routine] Image export successful');
          Toast.show('Image exported successfully', 'success');
        }, 'image/png');
      } catch (e) {
        console.log('[EWU Helper][Routine] Image export failed:', e.message, e);
        warn('Image export failed:', e);
        Toast.show('Image export failed: ' + (e.message || 'Unknown error'), 'error');
      }
      this._showLoad(false);
    },

    _showLoad: function (show) {
      var el = safeQuery('#ewu-rg-loading');
      if (el) el.style.display = show ? 'flex' : 'none';
    },

    reset: function () {
      this._apiData = null;
      this._tableReady = false;
      this._hooksInstalled = false;
      this._modalOpen = false;
      this._currentOpts = null;
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      var wrapper = safeQuery('#ewu-rg-btn-wrapper');
      if (wrapper) wrapper.remove();
      var m = safeQuery('#ewu-rg-modal');
      if (m) m.remove();
    },
  };


  /* ===========================================================
     OFFERED COURSES ENHANCER MODULE
     =========================================================== */

  var OfferedCoursesEnhancerModule = {
    API_KW: 'GetAllOfferedCourses',
    TBL: 'tblData',
    CONT: 'courseTable',
    DELAY: 300,
    _apiData: [],
    _hooksInstalled: false,
    _observer: null,
    _timer: null,
    _settings: {},
    _enhanced: false,
    _searchTimer: null,
    _lastBuildHash: '',  // prevent unnecessary rebuilds

    init: async function (settings) {
      this._settings = settings.modules || {};
      if (location.pathname.toLowerCase().indexOf('/home/offeredcoursesstudent') === -1 &&
          !safeQuery('[ng-controller="OfferedCoursesStudentController"]')) return;

      console.log('[EWU Helper][Offered Courses] Offered Courses page detected');
      log('Offered Courses Enhancer activating');
      debugLog('OC: active');
      this._hookAPI();
      this._watchTable();
      if (this._apiData.length > 0) this._scheduleEnhance();
    },

    _hookAPI: function () {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;
      var self = this;

      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try { var d = await res.clone().json(); self._handleData(d); } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) { this._ewu_oc = url; return origOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_oc && this._ewu_oc.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () { try { self._handleData(JSON.parse(xhr.responseText)); } catch (e) {} });
        }
        return origSend.apply(this, arguments);
      };
    },

    _handleData: function (data) {
      var items = data;
      if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
      if (!Array.isArray(items)) { console.log('[EWU Helper][Offered Courses] API response is not an array'); return; }

      console.log('[EWU Helper][Offered Courses] API data received, items:', items.length);

      // Merge new items into existing data
      if (items.length >= this._apiData.length && this._apiData.length > 0) {
        this._apiData = items;
      } else if (this._apiData.length === 0) {
        this._apiData = items;
      } else {
        for (var i = 0; i < items.length; i++) {
          var k = (items[i].CourseCode || '') + '|' + (items[i].SectionName || '');
          var exists = false;
          for (var j = 0; j < this._apiData.length; j++) {
            if ((this._apiData[j].CourseCode || '') + '|' + (this._apiData[j].SectionName || '') === k) {
              exists = true; break;
            }
          }
          if (!exists) this._apiData.push(items[i]);
        }
      }
      console.log('[EWU Helper][Offered Courses] Total items after merge:', this._apiData.length);
      debugLog('OC: ' + this._apiData.length + ' items');
      Toast.show('Offered courses data loaded', 'success');
      this._scheduleEnhance();
    },

    _watchTable: function () {
      var container = safeQuery('#' + this.CONT);
      if (!container) return;
      var self = this;
      this._observer = new MutationObserver(function () {
        // Throttle: only schedule if not already pending
        if (!self._timer) self._scheduleEnhance();
      });
      this._observer.observe(container, { childList: true, subtree: true });
      var table = safeQuery('#' + this.TBL);
      if (table && table.querySelectorAll('tr').length > 2 && this._apiData.length > 0) this._scheduleEnhance();
    },

    _scheduleEnhance: function () {
      if (this._timer) return; // Already scheduled
      var self = this;
      this._timer = setTimeout(function () {
        self._timer = null;
        self._doEnhance();
      }, this.DELAY);
    },

    _doEnhance: function () {
      var data = this._extractData();
      if (!data || !data.length) return;

      // Skip rebuild if data hash hasn't changed
      var hash = data.length + ':' + (data[0] ? data[0].courseCode : '');
      if (hash === this._lastBuildHash && this._enhanced) return;
      this._lastBuildHash = hash;

      var table = safeQuery('#' + this.TBL);
      if (!table) return;

      this._buildTable(data, table);
      if (!this._enhanced) {
        this._enhanced = true;
        this._injectSearch(table);
      }
    },

    _extractData: function () {
      if (this._apiData.length > 0) {
        var courses = [];
        for (var i = 0; i < this._apiData.length; i++) {
          var item = this._apiData[i];
          if (!item || !item.CourseCode) continue;
          var cc = item.CourseCode.trim();
          var cap = parseInt(item.SeatCapacity, 10) || 0;
          var taken = parseInt(item.SeatTaken, 10) || 0;
          courses.push({
            courseCode: cc,
            courseName: (item.CourseName || '').trim(),
            section: (item.SectionName || '').trim(),
            faculty: (item.ShortName || item.FacultyName || '').trim() || '-',
            capacity: cap,
            left: Math.max(0, cap - taken),
            timing: (item.TimeSlotName || '').trim(),
            room: (item.RoomCode || item.RoomName || '').trim() || '-',
            dept: (item.DedicateDepartmentName || '').trim() || '-'
          });
        }
        if (courses.length) return courses;
      }
      // Fallback: parse from DOM
      var table = safeQuery('#' + this.TBL);
      if (!table) return [];
      var rows = table.querySelectorAll('tr');
      var courses = [];
      for (var j = 1; j < rows.length; j++) {
        var cells = rows[j].querySelectorAll('td');
        if (cells.length < 4) continue;
        var code = (cells[0] || {}).textContent;
        if (!code || !code.trim()) continue;
        var ct = ((cells[5] || {}).textContent || '').split('/');
        courses.push({
          courseCode: code.trim(),
          courseName: '',
          section: ((cells[1] || {}).textContent || '').trim(),
          faculty: '-',
          capacity: parseInt(ct[1], 10) || 0,
          left: Math.max(0, (parseInt(ct[1], 10) || 0) - (parseInt(ct[0], 10) || 0)),
          timing: ((cells[2] || {}).textContent || '').trim(),
          room: ((cells[3] || {}).textContent || '').trim() || '-',
          dept: ((cells[4] || {}).textContent || '').trim() || '-'
        });
      }
      return courses;
    },

    _buildTable: function (data, table) {
      var colorLeft = this._settings.offeredCoursesColorLeft !== false;
      var sticky = this._settings.offeredCoursesStickyHeader !== false ? ' ewu-oc-sticky-header' : '';

      var h = '<thead><tr class="' + sticky + '">';
      var headers = ['Course', 'Section', 'Faculty', 'Capacity', 'Left', 'Timing', 'Room No.', 'Dedicated Department'];
      for (var i = 0; i < headers.length; i++) {
        h += '<th class="ewu-oc-th">' + escapeHTML(headers[i]) + '</th>';
      }
      h += '</tr></thead><tbody>';

      for (var j = 0; j < data.length; j++) {
        var c = data[j];
        var rc = 'ewu-oc-row' + (j % 2 === 0 ? ' ewu-oc-row-even' : ' ewu-oc-row-odd');
        // Store full searchable text in data attributes
        var searchText = [c.courseCode, c.section, c.faculty, c.timing, c.room, c.dept, c.courseName].join(' ').toLowerCase();
        h += '<tr class="' + rc + '" data-search="' + escapeHTML(searchText) + '">';
        h += '<td class="ewu-oc-td ewu-oc-td-course">' + escapeHTML(c.courseCode) + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-section">' + escapeHTML(c.section) + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-faculty">' + escapeHTML(c.faculty) + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-capacity">' + c.capacity + '</td>';

        var lc = 'ewu-oc-left';
        if (colorLeft) {
          if (c.left === 0) lc += ' ewu-oc-left-red';
          else if (c.left <= 10) lc += ' ewu-oc-left-yellow';
          else lc += ' ewu-oc-left-green';
        }
        h += '<td class="ewu-oc-td ' + lc + '">' + c.left + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-timing">' + escapeHTML(c.timing) + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-room">' + escapeHTML(c.room) + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-dept">' + escapeHTML(c.dept) + '</td>';
        h += '</tr>';
      }
      h += '</tbody>';
      table.innerHTML = h;
      table.className = 'table table-striped grid-table ewu-oc-table';
      if (table.getAttribute('border') !== '1') table.setAttribute('border', '1');
    },

    _injectSearch: function (table) {
      if (this._settings.offeredCoursesSearchBox === false) return;
      if (safeQuery('#ewu-oc-search')) return;
      var container = safeQuery('#' + this.CONT);
      if (!container) return;

      var wrapper = document.createElement('div');
      wrapper.id = 'ewu-oc-search';
      wrapper.className = 'ewu-oc-search-wrapper';

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'ewu-oc-search-input';
      input.className = 'ewu-oc-search-input';
      input.placeholder = this._settings.offeredCoursesSearchPlaceholder || 'Search by course or faculty...';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');

      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.id = 'ewu-oc-search-clear';
      clearBtn.className = 'ewu-oc-search-clear';
      clearBtn.innerHTML = '&times;';
      clearBtn.title = 'Clear';

      wrapper.appendChild(input);
      wrapper.appendChild(clearBtn);

      // Insert before the table's parent wrapper, outside scroll area
      var dp = table.closest('#divPrint') || table.parentElement;
      container.insertBefore(wrapper, dp || table);
      console.log('[EWU Helper][Offered Courses] Search bar injected');

      var self = this;
      input.addEventListener('input', function () {
        if (self._searchTimer) clearTimeout(self._searchTimer);
        self._searchTimer = setTimeout(function () {
          self._searchTimer = null;
          self._filter(input.value.trim());
          clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
        }, 150); // Faster debounce for smoother search
      });
      clearBtn.addEventListener('click', function () {
        input.value = '';
        self._filter('');
        clearBtn.style.display = 'none';
        input.focus();
      });

      // Ctrl+K shortcut to focus search
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          input.focus();
          input.select();
          console.log('[EWU Helper][Offered Courses] Search focused via Ctrl+K');
        }
      });
    },

    _filter: function (q) {
      var rows = safeQueryAll('.ewu-oc-row');
      if (!q) {
        for (var i = 0; i < rows.length; i++) rows[i].style.display = '';
        return;
      }
      q = q.toLowerCase();
      for (var j = 0; j < rows.length; j++) {
        var searchText = (rows[j].getAttribute('data-search') || '').toLowerCase();
        rows[j].style.display = searchText.indexOf(q) !== -1 ? '' : 'none';
      }
    },

    reset: function () {
      this._apiData = [];
      this._hooksInstalled = false;
      this._enhanced = false;
      this._lastBuildHash = '';
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._searchTimer) { clearTimeout(this._searchTimer); this._searchTimer = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      var sb = safeQuery('#ewu-oc-search');
      if (sb) sb.remove();
    },
  };


  /* ===========================================================
     MODULE LOADER
     =========================================================== */

  function loadModules(pageInfo, settings) {
    if (!settings.enabled || !pageInfo) return;
    if (pageInfo.id === 'login' && settings.modules.loginHelper) {
      LoginHelperModule.reset();
      LoginHelperModule.init(settings);
    }
    if (pageInfo.id === 'classSchedule' && settings.modules.routineGenerator) {
      RoutineGeneratorModule.reset();
      RoutineGeneratorModule.init(settings);
    }
    if (pageInfo.id === 'offeredCourses' && settings.modules.offeredCoursesEnhancer) {
      OfferedCoursesEnhancerModule.reset();
      OfferedCoursesEnhancerModule.init(settings);
    }
  }


  /* ===========================================================
     SETTINGS LISTENER (from popup)
     =========================================================== */

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function (msg, _s, respond) {
      if (msg && msg.type === 'EWU_SETTINGS_UPDATED') {
        handleSettingsUpdate(msg.settings);
        respond({ ok: true });
      }
    });
  }

  async function handleSettingsUpdate(ns) {
    _settings = ns;
    applyBodyClasses(ns);
    if (!ns.enabled) {
      LoginHelperModule.reset();
      RoutineGeneratorModule.reset();
      OfferedCoursesEnhancerModule.reset();
    } else {
      var pi = detectPage();
      loadModules(pi, ns);
    }
  }


  /* ===========================================================
     SPA NAVIGATION HANDLER
     =========================================================== */

  function setupSPA() {
    var origPS = history.pushState, origRS = history.replaceState;
    history.pushState = function () {
      var r = origPS.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return r;
    };
    history.replaceState = function () {
      var r = origRS.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return r;
    };
    window.addEventListener('popstate', function () {
      window.dispatchEvent(new Event('locationchange'));
    });
    window.addEventListener('locationchange', function () {
      log('SPA nav:', location.pathname);
      handleNav();
    });
  }

  var _navTimer = null;
  async function handleNav() {
    if (_navTimer) clearTimeout(_navTimer);
    _navTimer = setTimeout(async function () {
      _navTimer = null;
      LoginHelperModule.reset();
      RoutineGeneratorModule.reset();
      OfferedCoursesEnhancerModule.reset();

      var pi = detectPage();
      log('Nav ->', pi ? pi.id : 'not a target page');
      updateBadgeStatus(null);

      if (_settings && _settings.enabled) loadModules(pi, _settings);
    }, 500);
  }

  // Placeholder - badge removed but function kept for module compatibility
  function updateBadgeStatus() { /* no-op: badge removed */ }


  /* ===========================================================
     PAGE HOOK INJECTION
     =========================================================== */

  function injectPageHook() {
    try {
      var s = document.createElement('script');
      s.src = chrome.runtime.getURL('pageHook.js');
      s.onload = function () { s.remove(); };
      s.onerror = function () { console.log('[EWU Helper] pageHook.js failed to load'); s.remove(); };
      (document.head || document.documentElement).appendChild(s);
      console.log('[EWU Helper] pageHook.js injected');
    } catch (e) {
      console.log('[EWU Helper] Failed to inject pageHook.js:', e);
    }
  }

  function setupPageHookListener() {
    window.addEventListener('message', function (event) {
      if (event.source !== window) return;
      if (event.data.type !== 'EWU_API_DATA') return;

      console.log('[EWU Helper] Received API data from pageHook:', event.data.apiKey);

      // Route data to appropriate module
      if (event.data.apiKey === 'GetAllOfferedCourses') {
        OfferedCoursesEnhancerModule._handleData(event.data.data);
      } else if (event.data.apiKey === 'GetSemesterStudentWiseAdvisingCourseListStudent') {
        RoutineGeneratorModule._apiData = event.data.data;
        RoutineGeneratorModule._updateBtn(true);
      }
    });
  }

  /* ===========================================================
     MAIN INITIALIZATION
     =========================================================== */

  async function main() {
    log('EWU Portal Helper v' + CONFIG.VERSION + ' starting...');
    _settings = await loadSettings();

    if (!location.href.startsWith(CONFIG.PORTAL_BASE)) return;

    var pageInfo = detectPage();

    // If not a target page, stay silent - no UI injection
    if (!pageInfo) {
      log('Not a target page, extension idle.');
      return;
    }

    log('Target page:', pageInfo.id, '-', pageInfo.label);
    applyBodyClasses(_settings);

    // Inject page-level hook early to capture API calls
    injectPageHook();
    setupPageHookListener();

    if (_settings.enabled) {
      // Show single activation toast
      Toast.show('Extension active', 'success', 2500);
    }

    loadModules(pageInfo, _settings);
    setupSPA();
    log('Ready');
  }

  main();

})();
