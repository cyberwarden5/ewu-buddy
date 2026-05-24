/* =============================================================
   EWU Portal Helper - Page-Level Hook
   Captures fetch/XHR responses before content script processes them
   ============================================================= */

(function () {
  'use strict';

  // Store captured API data
  var capturedData = {};

  // Intercept Fetch API
  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = async function () {
      var response = await originalFetch.apply(this, arguments);
      
      // Check if this is an API call we care about
      var url = '';
      if (typeof arguments[0] === 'string') {
        url = arguments[0];
      } else if (arguments[0] && arguments[0].url) {
        url = arguments[0].url;
      }

      // Capture GetAllOfferedCourses API
      if (url.indexOf('GetAllOfferedCourses') !== -1) {
        try {
          var cloned = response.clone();
          var data = await cloned.json();
          console.log('[PageHook] GetAllOfferedCourses captured:', data);
          // Send to content script
          window.postMessage({
            type: 'EWU_API_DATA',
            apiKey: 'GetAllOfferedCourses',
            data: data
          }, '*');
        } catch (e) {
          console.log('[PageHook] Failed to parse GetAllOfferedCourses response:', e);
        }
      }

      // Capture GetSemesterStudentWiseAdvisingCourseListStudent API
      if (url.indexOf('GetSemesterStudentWiseAdvisingCourseListStudent') !== -1) {
        try {
          var cloned = response.clone();
          var data = await cloned.json();
          console.log('[PageHook] GetSemesterStudentWiseAdvisingCourseListStudent captured:', data);
          // Send to content script
          window.postMessage({
            type: 'EWU_API_DATA',
            apiKey: 'GetSemesterStudentWiseAdvisingCourseListStudent',
            data: data
          }, '*');
        } catch (e) {
          console.log('[PageHook] Failed to parse schedule response:', e);
        }
      }

      return response;
    };
  }

  // Intercept XMLHttpRequest
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ewuHookUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var url = this._ewuHookUrl || '';

    // Setup interceptor for responses
    var originalOnreadystatechange = xhr.onreadystatechange;
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        // Capture GetAllOfferedCourses XHR
        if (url.indexOf('GetAllOfferedCourses') !== -1) {
          try {
            var data = JSON.parse(xhr.responseText);
            console.log('[PageHook] GetAllOfferedCourses XHR captured:', data);
            window.postMessage({
              type: 'EWU_API_DATA',
              apiKey: 'GetAllOfferedCourses',
              data: data
            }, '*');
          } catch (e) {
            console.log('[PageHook] Failed to parse GetAllOfferedCourses XHR response:', e);
          }
        }

        // Capture GetSemesterStudentWiseAdvisingCourseListStudent XHR
        if (url.indexOf('GetSemesterStudentWiseAdvisingCourseListStudent') !== -1) {
          try {
            var data = JSON.parse(xhr.responseText);
            console.log('[PageHook] GetSemesterStudentWiseAdvisingCourseListStudent XHR captured:', data);
            window.postMessage({
              type: 'EWU_API_DATA',
              apiKey: 'GetSemesterStudentWiseAdvisingCourseListStudent',
              data: data
            }, '*');
          } catch (e) {
            console.log('[PageHook] Failed to parse schedule XHR response:', e);
          }
        }
      }

      if (originalOnreadystatechange) {
        return originalOnreadystatechange.call(xhr);
      }
    };

    return originalSend.apply(this, arguments);
  };

  console.log('[PageHook] EWU Portal Helper page hook loaded');
})();
