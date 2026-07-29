/**
 * app.js - Main application logic for Cloud Summit 2026 Frontend
 * Communicates with Event Service, Program Service, and Registration Service APIs
 */

(function ($) {
  'use strict';

  /* ============================================================
     API Base URLs (injected via environment or window config)
     These are overridden by nginx config in production
     ============================================================ */
  var API = {
    events:       (window.API_EVENTS       || '/api/events'),
    programs:     (window.API_PROGRAMS     || '/api/programs'),
    registration: (window.API_REGISTRATION || '/api/registrations'),
    analytics:    (window.API_ANALYTICS    || '/api/analytics/event')
  };

  /* ============================================================
     Countdown Timer
     ============================================================ */
  function initCountdown() {
    var eventDate = new Date('2026-08-15T09:00:00');
    var countdownEl = $('#countdown');

    function update() {
      var now = new Date();
      var diff = eventDate - now;
      if (diff <= 0) {
        countdownEl.html('<p style="color:#f0a500;font-size:20px;font-weight:700;">Event is Live!</p>');
        return;
      }
      var days    = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((diff % (1000 * 60)) / 1000);

      countdownEl.html(
        '<div class="countdown-item"><span class="countdown-number">' + pad(days) + '</span><span class="countdown-label">Days</span></div>' +
        '<div class="countdown-item"><span class="countdown-number">' + pad(hours) + '</span><span class="countdown-label">Hours</span></div>' +
        '<div class="countdown-item"><span class="countdown-number">' + pad(minutes) + '</span><span class="countdown-label">Mins</span></div>' +
        '<div class="countdown-item"><span class="countdown-number">' + pad(seconds) + '</span><span class="countdown-label">Secs</span></div>'
      );
    }
    function pad(n) { return n < 10 ? '0' + n : n; }
    update();
    setInterval(update, 1000);
  }

  /* ============================================================
     Load Event Details from Event Service
     ============================================================ */
  function loadEventDetails() {
    $.ajax({
      url: API.events + '?limit=10',
      method: 'GET',
      timeout: 8000,
      success: function (data) {
        var events = data.events || data || [];
        if (!events.length) return;
        // Use first active event for display
        var event = events[0];
        if (event.ticket_price) {
          $('#ticket-price').text('£' + parseFloat(event.ticket_price).toFixed(0));
        }
        updateSeatsDisplay(event.seats_available);

        // Populate event dropdown
        var select = $('#reg-event');
        select.empty().append('<option value="">Select an event</option>');
        events.forEach(function (ev) {
          select.append(
            '<option value="' + escapeHtml(ev.id) + '">' +
            escapeHtml(ev.title) + ' — ' + escapeHtml(ev.venue) +
            '</option>'
          );
        });
      },
      error: function () {
        $('#seats-available').text('N/A');
        $('#reg-event').html('<option value="">Unable to load events</option>');
      }
    });
  }

  function updateSeatsDisplay(seats) {
    var seatsEl = $('#seats-available');
    seatsEl.text(seats);
    if (seats < 10 && seats > 0) {
      seatsEl.css('color', '#ff4444');
      $('.seats-low-banner').text('⚠ Only ' + seats + ' seats remaining — Register now!').show();
    } else {
      seatsEl.css('color', '#f0a500');
    }
  }

  /* ============================================================
     Load Program Schedule from Program Service
     ============================================================ */
  function loadPrograms() {
    $.ajax({
      url: API.programs + '?limit=100',
      method: 'GET',
      timeout: 8000,
      success: function (data) {
        var sessions = data.programs || data || [];
        renderProgramDay('day1', sessions, 1);
        renderProgramDay('day2', sessions, 2);
        renderProgramDay('day3', sessions, 3);
      },
      error: function () {
        $('.loading-spinner').html(
          '<p style="color:#888">Unable to load program schedule. Please refresh.</p>'
        );
      }
    });
  }

  function renderProgramDay(containerId, sessions, dayNum) {
    var filtered = sessions.filter(function (s) { return s.day === dayNum; });
    var container = $('#' + containerId);
    if (!filtered.length) {
      container.html('<p style="color:#888;padding:30px;text-align:center">No sessions scheduled for this day yet.</p>');
      return;
    }
    var html = '';
    filtered.forEach(function (s) {
      html += '<div class="program-item">' +
        '<div class="program-time">' + escapeHtml(s.start_time) + ' – ' + escapeHtml(s.end_time) + '</div>' +
        '<div class="program-details">' +
          '<h4>' + escapeHtml(s.session_title) + '</h4>' +
          '<span class="program-track">' + escapeHtml(s.track) + '</span>' +
          '<span class="program-speaker-tag"><i class="fa fa-user"></i> ' + escapeHtml(s.speaker_name) + '</span>' +
        '</div>' +
        '</div>';
    });
    container.html(html);
  }

  /* ============================================================
     Registration Form Submission
     ============================================================ */
  function initRegistrationForm() {
    $('#registration-form').on('submit', function (e) {
      e.preventDefault();

      var name        = $('#reg-name').val().trim();
      var email       = $('#reg-email').val().trim();
      var ticketCount = parseInt($('#reg-tickets').val(), 10);
      var eventId     = $('#reg-event').val();
      var alertEl     = $('#register-alert');

      // Client-side validation
      if (!name || !email || !ticketCount || !eventId) {
        showAlert(alertEl, 'danger', 'Please fill in all required fields.');
        return;
      }
      if (!isValidEmail(email)) {
        showAlert(alertEl, 'danger', 'Please enter a valid email address.');
        return;
      }

      var $btn = $('#submit-registration').prop('disabled', true)
        .html('<i class="fa fa-spinner fa-spin"></i> Processing...');

      $.ajax({
        url: API.registration,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          event_id:     eventId,
          name:         name,
          email:        email,
          ticket_count: ticketCount
        }),
        timeout: 10000,
        success: function (resp) {
          showAlert(alertEl, 'success',
            '<i class="fa fa-check-circle"></i> Registration confirmed! Ref: <strong>' +
            escapeHtml(resp.registration_id || '') + '</strong>. Check your email for details.');
          $('#registration-form')[0].reset();

          if (window.Analytics) {
            window.Analytics.sendEvent('registration_success', {
              event_id: eventId,
              ticket_count: ticketCount
            });
          }
          // Refresh seats
          loadEventDetails();
        },
        error: function (xhr) {
          var msg = 'Registration failed. Please try again.';
          try {
            var err = JSON.parse(xhr.responseText);
            if (err && err.message) msg = err.message;
          } catch (ex) {}
          showAlert(alertEl, 'danger', '<i class="fa fa-exclamation-circle"></i> ' + escapeHtml(msg));

          if (window.Analytics) {
            window.Analytics.sendEvent('registration_error', { error: msg });
          }
        },
        complete: function () {
          $btn.prop('disabled', false)
            .html('<i class="fa fa-check"></i> Confirm Registration');
        }
      });
    });
  }

  /* ============================================================
     Smooth Scrolling
     ============================================================ */
  function initSmoothScroll() {
    $('a[href^="#"]').on('click', function (e) {
      var target = $(this.getAttribute('href'));
      if (!target.length) return;
      e.preventDefault();
      $('html, body').animate({ scrollTop: target.offset().top - 65 }, 600, 'swing');
    });
  }

  /* ============================================================
     Navbar Scroll Effect
     ============================================================ */
  function initNavbarScroll() {
    $(window).on('scroll', function () {
      if ($(this).scrollTop() > 50) {
        $('#navbar-main').css('background', 'rgba(20,20,40,0.98)');
      } else {
        $('#navbar-main').css('background', 'rgba(20,20,40,0.95)');
      }
    });
  }

  /* ============================================================
     Utility: Safe HTML escaping (prevent XSS)
     ============================================================ */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showAlert(el, type, msg) {
    el.removeClass('alert-success alert-danger alert-warning')
      .addClass('alert alert-' + type)
      .html(msg)
      .show();
    $('html, body').animate({ scrollTop: el.offset().top - 80 }, 400);
  }

  /* ============================================================
     Init on DOM Ready
     ============================================================ */
  $(document).ready(function () {
    initCountdown();
    loadEventDetails();
    loadPrograms();
    initRegistrationForm();
    initSmoothScroll();
    initNavbarScroll();

    // Seats low banner close on click
    $(document).on('click', '.seats-low-banner', function () {
      $(this).hide();
    });
  });

})(jQuery);
