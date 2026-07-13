/* =========================================================
   gtm-tracking.js — GTM dataLayer events for 寮寮ワーク LP
   ---------------------------------------------------------
   Load AFTER script.js. This file does NOT modify script.js;
   it wraps the existing global functions and listens for
   clicks/changes, so all original behavior stays exactly the
   same.

   Event names below match what was confirmed with the client
   (Fixya / GTM side) on 2026-07-10:

     step_view      ... each step shown       { form_step, form_total_steps }
     step_answer    ... user selects an answer { form_step, answer_field, answer }
     line_click     ... any LINE button        { link_location }
     tel_click      ... any tel: link          { link_location, phone_number }
     form_submit    ... thank-you shown        <-- MAIN CONVERSION

   Also silently attaches tracking parameters (gclid/utm_*) and
   the LP URL onto the form submission payload, so submit.php
   can append them to the notification email as requested
   ("Additional Information" block, appended at the bottom —
   existing email fields/order are left untouched).
   ========================================================= */
(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  function push(eventName, params) {
    var payload = { event: eventName };
    if (params) {
      for (var key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          payload[key] = params[key];
        }
      }
    }
    window.dataLayer.push(payload);
  }

  /* ---------------------------------------------------------
     1) Step views: wrap renderStepStates to log each step
     --------------------------------------------------------- */
  var _renderStepStates = window.renderStepStates;
  if (typeof _renderStepStates === "function") {
    var lastTrackedStep = null;
    window.renderStepStates = function () {
      _renderStepStates();
      try {
        if (
          typeof currentStep !== "undefined" &&
          currentStep !== lastTrackedStep
        ) {
          lastTrackedStep = currentStep;
          push("step_view", {
            form_step: currentStep,
            form_total_steps: 5,
          });
        }
      } catch (e) {
        /* tracking must never break the form */
      }
    };
  }

  /* ---------------------------------------------------------
     2) Step answers: card choices (Step 1-3) + gender (Step 4)
     --------------------------------------------------------- */
  var _selectCardOption = window.selectCardOption;
  if (typeof _selectCardOption === "function") {
    window.selectCardOption = function (element) {
      _selectCardOption.apply(this, arguments);
      try {
        var txtEl = element.querySelector(".card-main-txt");
        var answer = (txtEl ? txtEl.innerText : element.innerText || "").trim();
        push("step_answer", {
          form_step: currentStep,
          answer_field: "selection_card",
          answer: answer,
        });
      } catch (e) {
        /* ignore */
      }
    };
  }

  var _selectGender = window.selectGender;
  if (typeof _selectGender === "function") {
    window.selectGender = function (element, value) {
      _selectGender.apply(this, arguments);
      try {
        push("step_answer", {
          form_step: currentStep,
          answer_field: "gender",
          answer: value || (element ? element.innerText.trim() : ""),
        });
      } catch (e) {
        /* ignore */
      }
    };
  }

  /* ---------------------------------------------------------
     3) Step answers: dropdown fields on Step 4
        (prefecture, birth year/month/day)
     --------------------------------------------------------- */
  document.addEventListener(
    "change",
    function (e) {
      var t = e.target;
      if (!t || !t.id) return;
      var trackedIds = ["prefSelect", "birthYear", "birthMonth", "birthDay"];
      if (trackedIds.indexOf(t.id) === -1) return;
      try {
        push("step_answer", {
          form_step: 4,
          answer_field: t.id,
          answer: t.value,
        });
      } catch (e2) {
        /* ignore */
      }
    },
    true,
  );

  /* ---------------------------------------------------------
     4) Form submit: fires when the thank-you view is shown
     --------------------------------------------------------- */
  var _switchView = window.switchView;
  if (typeof _switchView === "function") {
    window.switchView = function (fromId, toId) {
      _switchView(fromId, toId);
      try {
        if (toId === "thankYouView") {
          push("form_submit"); // main conversion event
        }
      } catch (e) {
        /* tracking must never break the form */
      }
    };
  }

  /* ---------------------------------------------------------
     5) LINE + phone clicks, everywhere on the page
        (capture phase = fires before the navigation happens)
     --------------------------------------------------------- */
  document.addEventListener(
    "click",
    function (e) {
      var target =
        e.target && e.target.closest
          ? e.target.closest(
              'a[href^="tel:"], a[href*="l-tra.com"], #lineMainAction',
            )
          : null;
      if (!target) return;

      var linkLocation = "unknown";
      if (target.closest("#abandonmentModalOverlay")) {
        linkLocation = "exit_modal";
      } else if (target.closest("#thankYouView")) {
        linkLocation = "thank_you";
      } else if (target.closest(".site-header")) {
        linkLocation = "header";
      } else if (target.closest("#landingView")) {
        linkLocation = "landing";
      }

      var href = target.getAttribute("href") || "";
      if (href.indexOf("tel:") === 0) {
        push("tel_click", {
          link_location: linkLocation,
          phone_number: href.replace("tel:", ""),
        });
      } else {
        push("line_click", { link_location: linkLocation });
      }
    },
    true,
  );

  /* ---------------------------------------------------------
     6) Attach tracking parameters + LP URL to the submission
        payload, without touching script.js. These land in
        submit.php as tracking_* fields and get appended to
        the notification email as "Additional Information",
        below the existing fields the client's GAS script
        already parses.
     --------------------------------------------------------- */
  var _collectFormData = window.collectFormData;
  if (typeof _collectFormData === "function") {
    window.collectFormData = function () {
      var data = _collectFormData.apply(this, arguments);
      try {
        var params = new URLSearchParams(window.location.search);
        data.tracking_gclid = params.get("gclid") || "";
        data.tracking_utm_source = params.get("utm_source") || "";
        data.tracking_utm_medium = params.get("utm_medium") || "";
        data.tracking_utm_campaign = params.get("utm_campaign") || "";
        data.lp_url = window.location.href;
      } catch (e) {
        /* ignore */
      }
      return data;
    };
  }
})();
