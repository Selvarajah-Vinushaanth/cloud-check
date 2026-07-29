/**
 * analytics.js - Web Analytics Tracker for Cloud Summit 2026
 * Captures analytics events and streams to ClickHouse via the Analytics Collector API
 *
 * Tracked Metrics:
 *  1. Page Views         - URL, referrer, user-agent, timestamp
 *  2. Session Duration   - Time-on-page, scroll depth reached
 *  3. CTA Button Clicks  - Which buttons are clicked (register, nav links, etc.)
 *  4. Video Play Events  - Which videos are played and how many times
 *  5. Section Visibility - Which sections the user actually viewed (Intersection Observer)
 *  6. Registration Form  - Submit attempts, success, abandonment (form field focus without submit)
 *  7. Speaker Profile Views - Which speaker cards are hovered / viewed
 */

(function () {
  'use strict';

  // ---- Config ----
  var ANALYTICS_ENDPOINT = (window.ANALYTICS_ENDPOINT || '/api/analytics/event');
  var SESSION_ID = generateSessionId();
  var PAGE_LOAD_TIME = Date.now();
  var MAX_SCROLL_DEPTH = 0;
  var SECTIONS_VIEWED = [];
  var FORM_STARTED = false;
  var PAGE_PATH = window.location.pathname + window.location.search;

  // ---- Helper: Generate session ID ----
  function generateSessionId() {
    var stored = sessionStorage.getItem('cs_session_id');
    if (stored) return stored;
    var id = 'cs_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem('cs_session_id', id);
    return id;
  }

  // ---- Helper: Get or create visitor ID (persistent across sessions) ----
  function getVisitorId() {
    var vid = localStorage.getItem('cs_visitor_id');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('cs_visitor_id', vid);
    }
    return vid;
  }

  // ---- Core send function ----
  function sendEvent(eventType, properties) {
    var payload = {
      session_id: SESSION_ID,
      visitor_id: getVisitorId(),
      event_type: eventType,
      page_url: PAGE_PATH,
      referrer: document.referrer || '',
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      timestamp: new Date().toISOString(),
      properties: properties || {}
    };

    // Use navigator.sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    } else {
      // Fallback: async XHR
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ANALYTICS_ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // =========================================================
  // METRIC 1: Page View
  // =========================================================
  sendEvent('page_view', {
    title: document.title,
    page_path: PAGE_PATH
  });

  // =========================================================
  // METRIC 2: Scroll Depth Tracking
  // =========================================================
  function getScrollDepthPercent() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    return docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
  }

  var scrollDebounce;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(function () {
      var depth = getScrollDepthPercent();
      if (depth > MAX_SCROLL_DEPTH) {
        MAX_SCROLL_DEPTH = depth;
        // Fire milestone events at 25%, 50%, 75%, 100%
        [25, 50, 75, 100].forEach(function (milestone) {
          if (depth >= milestone && !window['_scroll_' + milestone]) {
            window['_scroll_' + milestone] = true;
            sendEvent('scroll_depth', { depth_percent: milestone });
          }
        });
      }
    }, 200);
  });

  // =========================================================
  // METRIC 3: Session Duration (on page hide/unload)
  // =========================================================
  function sendSessionEnd() {
    var duration = Math.round((Date.now() - PAGE_LOAD_TIME) / 1000);
    sendEvent('session_duration', {
      duration_seconds: duration,
      max_scroll_depth: MAX_SCROLL_DEPTH,
      sections_viewed: SECTIONS_VIEWED
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      sendSessionEnd();
    }
  });
  window.addEventListener('beforeunload', sendSessionEnd);

  // =========================================================
  // METRIC 4: CTA / Button Click Tracking (data-analytics attrs)
  // =========================================================
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-analytics]');
    if (!target) return;
    var label = target.getAttribute('data-analytics');
    sendEvent('button_click', {
      label: label,
      element_text: (target.innerText || '').trim().substring(0, 100),
      element_type: target.tagName.toLowerCase()
    });
  });

  // =========================================================
  // METRIC 5: Video Play Tracking
  // =========================================================
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('.video-thumb');
    if (!thumb) return;
    var videoId = thumb.getAttribute('data-video-id');
    var analyticsLabel = thumb.getAttribute('data-analytics');
    sendEvent('video_play', {
      video_id: videoId,
      label: analyticsLabel
    });
  });

  // =========================================================
  // METRIC 6: Section Visibility Tracking (Intersection Observer)
  // =========================================================
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          var sectionId = entry.target.getAttribute('id');
          if (sectionId && SECTIONS_VIEWED.indexOf(sectionId) === -1) {
            SECTIONS_VIEWED.push(sectionId);
            sendEvent('section_view', {
              section_id: sectionId,
              time_since_load_ms: Date.now() - PAGE_LOAD_TIME
            });
          }
        }
      });
    }, { threshold: 0.3 });

    var sections = ['home', 'videos', 'speakers', 'programs', 'register'];
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
  }

  // =========================================================
  // METRIC 7: Registration Form Behaviour
  //   - Form field first-focus (user started form)
  //   - Form submission attempt
  //   - Form abandonment (user focused but didn't submit)
  // =========================================================
  var regForm = document.getElementById('registration-form');
  if (regForm) {
    var formFields = regForm.querySelectorAll('input, select');
    formFields.forEach(function (field) {
      field.addEventListener('focus', function () {
        if (!FORM_STARTED) {
          FORM_STARTED = true;
          sendEvent('form_start', {
            form_id: 'registration-form',
            first_field: field.id
          });
        }
      });
    });

    regForm.addEventListener('submit', function (e) {
      sendEvent('form_submit_attempt', {
        form_id: 'registration-form',
        ticket_count: document.getElementById('reg-tickets').value
      });
    });
  }

  // =========================================================
  // METRIC 8: Speaker Card Hover Tracking
  // =========================================================
  document.addEventListener('mouseover', function (e) {
    var card = e.target.closest('.speaker-card[data-analytics]');
    if (!card || card._analyticsTracked) return;
    card._analyticsTracked = true;
    sendEvent('speaker_hover', {
      analytics_label: card.getAttribute('data-analytics'),
      speaker_name: (card.querySelector('h4') || {}).innerText || ''
    });
  });

  // =========================================================
  // METRIC 9: Program Tab Clicks
  // =========================================================
  document.addEventListener('click', function (e) {
    var tabLink = e.target.closest('#program-tabs a[data-toggle="tab"]');
    if (!tabLink) return;
    var label = tabLink.getAttribute('data-analytics') || tabLink.getAttribute('href');
    sendEvent('program_tab_click', { tab: label });
  });

  // =========================================================
  // METRIC 10: Navigation Link Tracking
  // =========================================================
  document.addEventListener('click', function (e) {
    var navLink = e.target.closest('.navbar-nav a[data-analytics]');
    if (!navLink) return;
    sendEvent('nav_click', {
      destination: navLink.getAttribute('href'),
      label: navLink.getAttribute('data-analytics')
    });
  });

  // Expose sendEvent globally for use in app.js
  window.Analytics = { sendEvent: sendEvent, sessionId: SESSION_ID };

})();
