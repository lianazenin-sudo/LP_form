/* =========================================================
   Diagnostic Wizard – cleaned & de-duplicated
   ========================================================= */

/* ---------------------------------------------------------
   FORM SUBMISSION ENDPOINT
   Points at submit-application.php, which must live in the
   SAME folder as form.html on your XServer hosting.
   If you ever move it, change this to the full URL instead,
   e.g. 'https://your-real-domain.com/submit-application.php'
--------------------------------------------------------- */
const FORM_SUBMIT_ENDPOINT = "submit.php";

let currentStep = 1;
const totalSteps = 5;
let inactivityTimer;
let hasPopupOpened = false;

/* ---------------------------------------------------------
   Birthday dropdown population
   CLIENT SPEC: selectable years go back as far as 1970.
   The newest selectable year is computed automatically as
   (current year - 18) so applicants are always 18+ without
   this file needing yearly maintenance.
--------------------------------------------------------- */
const OLDEST_BIRTH_YEAR = 1970;                            // ← client spec: back to 1970
const NEWEST_BIRTH_YEAR = new Date().getFullYear() - 18;   // auto: 18 years old or over

function populateDateMenus() {
  const yearMenu =
    document.getElementById("birthYear") || document.getElementById("year");
  const monthMenu =
    document.getElementById("birthMonth") || document.getElementById("month");
  const dayMenu =
    document.getElementById("birthDay") || document.getElementById("day");

  if (!yearMenu || !monthMenu || !dayMenu) return;

  yearMenu.innerHTML = '<option value="">年</option>';
  monthMenu.innerHTML = '<option value="">月</option>';
  dayMenu.innerHTML = '<option value="">日</option>';

  for (let y = NEWEST_BIRTH_YEAR; y >= OLDEST_BIRTH_YEAR; y--)
    yearMenu.options.add(new Option(`${y}年`, y));
  for (let m = 1; m <= 12; m++) monthMenu.options.add(new Option(`${m}月`, m));
  for (let d = 1; d <= 31; d++) dayMenu.options.add(new Option(`${d}日`, d));
}

/* ---------------------------------------------------------
   View switching helper
--------------------------------------------------------- */

const VIEW_DISPLAY = {
  landingView: "flex",         
  diagnosticWizardView: "flex",
  thankYouView: "flex",
};

(function injectViewHiddenStyle() {
  if (document.getElementById("js-view-hidden-style")) return;
  const style = document.createElement("style");
  style.id = "js-view-hidden-style";
  style.textContent = ".js-view-hidden { display: none !important; }";
  document.head.appendChild(style);
})();

function showView(el) {
  if (!el) return;
  el.classList.remove("js-view-hidden");
  el.style.display = VIEW_DISPLAY[el.id] || "block";
  el.style.opacity = "";
  el.style.transform = "";
}

function hideView(el) {
  if (!el) return;
  el.classList.add("js-view-hidden");
  el.style.opacity = "";
  el.style.transform = "";
}

/* ---------------------------------------------------------
   Landing-mode body class
   Lets the landing view size itself to its own content
   (see the "body.landing-mode" CSS rule) instead of being
   forced to fill the full viewport height like Step 1–5 and
   the thank-you view need to. Toggled here instead of via a
   CSS :has() selector so the override is 100% deterministic
   in every browser.
--------------------------------------------------------- */
function setLandingBodyMode(isLanding) {
  document.body.classList.toggle("landing-mode", isLanding);
}

function switchView(fromId, toId) {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);

  hideView(from);
  showView(to);

  setLandingBodyMode(toId === "landingView");

  if (toId === "diagnosticWizardView") {
    currentStep = 1;
    renderStepStates();
  }

  window.scrollTo(0, 0);
}

window.startDiagnosticWizard = function () {
  switchView("landingView", "diagnosticWizardView");
};

function setupLandingNavigation() {
  const landingBtn =
    document.getElementById("diagnosticAction") ||
    document.getElementById("startBtn") ||
    document.querySelector(".landing-action-btn") ||
    document.querySelector(".btn-start");

  if (!landingBtn) {
    console.warn(
      "Start button not found. Check the button id/class on the landing page.",
    );
    return;
  }

  landingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    switchView("landingView", "diagnosticWizardView");
  });
}

/* ---------------------------------------------------------
   Card selection (Steps 1, 2, 3)
--------------------------------------------------------- */
function selectCardOption(element) {
  const container = element.parentElement;
  container
    .querySelectorAll(".selection-card")
    .forEach((c) => c.classList.remove("selected"));
  element.classList.add("selected");

  clearValidationError();
  setTimeout(() => navigateWizardNext(), 250);
}

function selectGender(element) {
  const row = element.parentElement;
  row
    .querySelectorAll(".gender-option-btn")
    .forEach((b) => b.classList.remove("selected"));
  element.classList.add("selected");
  clearValidationError();
}

function toggleCheckbox(element) {
  element.classList.toggle("checked");
}

/* ---------------------------------------------------------
   Validation error banner
--------------------------------------------------------- */
function triggerValidationError(message) {
  let alertBox = document.getElementById("customWizardAlert");

  if (!alertBox) {
    alertBox = document.createElement("div");
    alertBox.id = "customWizardAlert";
    alertBox.className = "custom-validation-alert";

    const navWrapper =
      document.getElementById("wizardNavigationWrapper") ||
      document.querySelector(".wizard-navigation-row") ||
      document.querySelector(".navigation-buttons");

    if (navWrapper) {
      navWrapper.parentNode.insertBefore(alertBox, navWrapper);
    } else {
      const activeContent = document.querySelector(
        ".wizard-step-content.active",
      );
      if (activeContent) activeContent.appendChild(alertBox);
    }
  } else {
    const navWrapper =
      document.getElementById("wizardNavigationWrapper") ||
      document.querySelector(".wizard-navigation-row") ||
      document.querySelector(".navigation-buttons");
    if (navWrapper && alertBox.nextSibling !== navWrapper) {
      navWrapper.parentNode.insertBefore(alertBox, navWrapper);
    }
  }

  alertBox.innerText = message;
  alertBox.style.display = "block";

  const wizardContainer =
    document.getElementById("diagnosticWizardView") ||
    document.querySelector(".wizard-container");
  if (wizardContainer) {
    wizardContainer.classList.remove("shake-element");
    void wizardContainer.offsetWidth;
    wizardContainer.classList.add("shake-element");
  }
}

function clearValidationError() {
  const alertBox = document.getElementById("customWizardAlert");
  if (alertBox) alertBox.style.display = "none";

  const wizardContainer =
    document.getElementById("diagnosticWizardView") ||
    document.querySelector(".wizard-container");
  if (wizardContainer) wizardContainer.classList.remove("shake-element");
}

/* ---------------------------------------------------------
   Collect every answer from all 5 steps into one object
--------------------------------------------------------- */
function collectFormData() {
  const getSelectedCardValue = (stepNum) => {
    const stepEl =
      document.querySelector(`.wizard-step-content[data-step="${stepNum}"]`) ||
      document.querySelectorAll(".wizard-step-content")[stepNum - 1];
    if (!stepEl) return "";
    const card = stepEl.querySelector(".selection-card.selected");
    if (!card) return "";
    return card.dataset.value || card.innerText.trim();
  };

  const prefElem =
    document.getElementById("prefSelect") ||
    document.getElementById("prefecture");
  const genderBtn = document.querySelector(".gender-option-btn.selected");
  const yElem =
    document.getElementById("birthYear") || document.getElementById("year");
  const mElem =
    document.getElementById("birthMonth") || document.getElementById("month");
  const dElem =
    document.getElementById("birthDay") || document.getElementById("day");
  const nameElem =
    document.getElementById("userNameInput") || document.getElementById("name");
  const emailElem =
    document.getElementById("userEmailInput") ||
    document.getElementById("email");
  const phoneElem =
    document.getElementById("userPhoneInput") ||
    document.getElementById("tel") ||
    document.getElementById("phone");

  // Matches id="phoneStoppedCheckbox" now added to the checkbox row in form.html
  const phoneStoppedElem =
    document.getElementById("phoneStoppedCheckbox") ||
    document.querySelector(".phone-stopped-checkbox");
  const phoneStopped =
    phoneStoppedElem && phoneStoppedElem.classList.contains("checked")
      ? "はい"
      : "いいえ";

  return {
    name: nameElem ? nameElem.value.trim() : "",
    email: emailElem ? emailElem.value.trim() : "",
    phone: phoneElem ? phoneElem.value.trim() : "",
    phoneStopped: phoneStopped,
    prefecture: prefElem ? prefElem.value : "",
    gender: genderBtn
      ? genderBtn.dataset.value || genderBtn.innerText.trim()
      : "",
    birthday: `${yElem ? yElem.value : ""}-${mElem ? mElem.value : ""}-${dElem ? dElem.value : ""}`,
    step1_寮希望: getSelectedCardValue(1),
    step2_悩み: getSelectedCardValue(2),
    step3_時期: getSelectedCardValue(3),
    submitted_at: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------
   Submit collected data to submit-application.php
--------------------------------------------------------- */
async function submitFormData(data) {
  try {
    const response = await fetch(FORM_SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (err) {
    console.error("Form submission failed:", err);
    return false;
  }
}

/* ---------------------------------------------------------
   Forward navigation
--------------------------------------------------------- */
async function navigateWizardNext() {
  clearValidationError();

  const currentStepContent =
    document.querySelector(
      `.wizard-step-content[data-step="${currentStep}"]`,
    ) || document.querySelectorAll(".wizard-step-content")[currentStep - 1];

  if (currentStep === 1 || currentStep === 2 || currentStep === 3) {
    const selectedCard =
      currentStepContent &&
      currentStepContent.querySelector(".selection-card.selected");
    if (!selectedCard) {
      triggerValidationError("選択肢から1つ選んでお進みください。");
      return;
    }
  }

  if (currentStep === 4) {
    const prefElem =
      document.getElementById("prefSelect") ||
      document.getElementById("prefecture");
    const prefSelect = prefElem ? prefElem.value : "";

    const selectedGender = document.querySelector(
      ".gender-option-btn.selected",
    );

    const yElem =
      document.getElementById("birthYear") || document.getElementById("year");
    const mElem =
      document.getElementById("birthMonth") || document.getElementById("month");
    const dElem =
      document.getElementById("birthDay") || document.getElementById("day");

    const birthYear = yElem ? yElem.value : "";
    const birthMonth = mElem ? mElem.value : "";
    const birthDay = dElem ? dElem.value : "";

    if (!prefSelect || prefSelect === "未選択") {
      triggerValidationError("お住まいの都道府県を選択してください。");
      return;
    }
    if (!selectedGender) {
      triggerValidationError("性別を選択してください。");
      return;
    }
    if (!birthYear || !birthMonth || !birthDay) {
      triggerValidationError("生年月日を正しく選択してください。");
      return;
    }
  }

  if (currentStep === totalSteps) {
    const nameElem =
      document.getElementById("userNameInput") ||
      document.getElementById("name");
    const emailElem =
      document.getElementById("userEmailInput") ||
      document.getElementById("email");
    const phoneElem =
      document.getElementById("userPhoneInput") ||
      document.getElementById("tel") ||
      document.getElementById("phone");

    const nameInput = nameElem ? nameElem.value.trim() : "";
    const emailInput = emailElem ? emailElem.value.trim() : "";
    const phoneInput = phoneElem ? phoneElem.value.trim() : "";

    if (nameInput === "") {
      triggerValidationError("お名前を入力してください。");
      nameElem && nameElem.focus();
      return;
    }

    if (emailInput === "" && phoneInput === "") {
      triggerValidationError(
        "メールアドレスまたは電話番号の、どちらか一方は必ず入力してください。",
      );
      return;
    }

    if (emailInput !== "") {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailInput)) {
        triggerValidationError(
          "正しいメールアドレスの形式で入力してください。",
        );
        emailElem && emailElem.focus();
        return;
      }
    }
  }

  if (currentStep < totalSteps) {
    if (currentStepContent) {
      currentStepContent.classList.add("fade-out-left");
      setTimeout(() => {
        currentStepContent.classList.remove("fade-out-left");
        currentStep++;
        renderStepStates();
      }, 200);
    } else {
      currentStep++;
      renderStepStates();
    }
  } else {
    const nextBtn =
      document.getElementById("nextNavBtn") ||
      document.querySelector(".next-btn");
    const originalBtnText = nextBtn ? nextBtn.innerText : "";
    if (nextBtn) {
      nextBtn.innerText = "送信中...";
      nextBtn.disabled = true;
    }

    const formData = collectFormData();
    const success = await submitFormData(formData);

    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.innerText = originalBtnText;
    }

    if (!success) {
      triggerValidationError("送信に失敗しました。もう一度お試しください。");
      return;
    }

    switchView("diagnosticWizardView", "thankYouView");
  }
}

/* ---------------------------------------------------------
   Backward navigation
--------------------------------------------------------- */
function navigateWizardBack() {
  clearValidationError();

  if (currentStep > 1) {
    const currentActiveStep =
      document.querySelector(
        `.wizard-step-content[data-step="${currentStep}"]`,
      ) || document.querySelectorAll(".wizard-step-content")[currentStep - 1];

    if (currentActiveStep) {
      currentActiveStep.style.opacity = "0";
      currentActiveStep.style.transform = "translateX(15px)";
      setTimeout(() => {
        currentStep--;
        renderStepStates();
      }, 200);
    } else {
      currentStep--;
      renderStepStates();
    }
  } else {
    switchView("diagnosticWizardView", "landingView");
  }
}

function renderStepStates() {
  const steps = document.querySelectorAll(".wizard-step-content");
  steps.forEach((p) => {
    p.classList.remove("active");
    p.removeAttribute("style");
  });

  const currentActiveStep =
    document.querySelector(
      `.wizard-step-content[data-step="${currentStep}"]`,
    ) || steps[currentStep - 1];
  if (currentActiveStep) currentActiveStep.classList.add("active");

  const progressBar =
    document.getElementById("wizardProgressBar") ||
    document.querySelector(".progress-bar-fill");
  if (progressBar)
    progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;

  const counterLabel =
    document.getElementById("stepCounterLabel") ||
    document.querySelector(".step-counter");
  if (counterLabel) counterLabel.innerText = `回答中 : ${currentStep} / 5`;

  const badge = document.getElementById("stepBadgePillText");
  if (badge)
    badge.innerText = currentStep === 5 ? "Last Step" : `Step ${currentStep}`;

  const nextBtn =
    document.getElementById("nextNavBtn") ||
    document.querySelector(".next-btn");
  if (nextBtn) nextBtn.innerText = currentStep === 5 ? "同意して進む" : "次へ";

  const titleBlock =
    document.getElementById("questionTitleBlock") ||
    document.querySelector(".question-title");
  if (titleBlock) {
    switch (currentStep) {
      case 1:
        titleBlock.innerHTML =
          '現在、寮付き（住み込み）<span class="blue-highlight">求人でお探しですか？</span>';
        break;
      case 2:
        titleBlock.innerHTML =
          '現在のお悩みに<span class="blue-highlight">一番近いもの</span>はどれですか？';
        break;
      case 3:
        titleBlock.innerHTML =
          'いつ頃から<span class="blue-highlight">勤務開始</span>を希望ですか？';
        break;
      case 4:
        titleBlock.innerHTML =
          'お住まいと<span class="blue-highlight">基本属性を教えてください</span>';
        break;
      case 5:
        titleBlock.innerHTML =
          'お仕事をご案内する<span class="blue-highlight">ご連絡先を入力してください</span>';
        break;
    }
  }

  clearValidationError();

  if (currentStep === 5) {
    const nameElem =
      document.getElementById("userNameInput") ||
      document.getElementById("name");
    if (nameElem) nameElem.setAttribute("required", "required");
  }
}

/* ---------------------------------------------------------
   Abandonment / exit-intent modal
--------------------------------------------------------- */
function triggerAbandonmentModal() {
  const wizardView = document.getElementById("diagnosticWizardView");
  const thankYouView = document.getElementById("thankYouView");

  if (thankYouView && !thankYouView.classList.contains("js-view-hidden"))
    return;
  if (hasPopupOpened) return;
  if (!wizardView || wizardView.classList.contains("js-view-hidden")) return;

  const overlay = document.getElementById("abandonmentModalOverlay");
  if (overlay) overlay.style.display = "flex";
  hasPopupOpened = true;
  clearTimeout(inactivityTimer);
}

function closeAbandonmentModal() {
  const overlay = document.getElementById("abandonmentModalOverlay");
  if (overlay) overlay.style.display = "none";
  resetInactivityTimer();
}

function resetInactivityTimer() {
  if (hasPopupOpened) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(triggerAbandonmentModal, 25000);
}

function setupMobileBackIntent() {
  window.history.pushState({ page: "wizard" }, "");
  window.addEventListener("popstate", () => {
    const wizardView = document.getElementById("diagnosticWizardView");
    if (
      wizardView &&
      !wizardView.classList.contains("js-view-hidden") &&
      !hasPopupOpened
    ) {
      triggerAbandonmentModal();
      window.history.pushState({ page: "wizard" }, "");
    }
  });
}

/* ---------------------------------------------------------
   Single init entry point
--------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  showView(document.getElementById("landingView"));
  hideView(document.getElementById("diagnosticWizardView"));
  hideView(document.getElementById("thankYouView"));
  setLandingBodyMode(true);

  populateDateMenus();
  setupLandingNavigation();
  resetInactivityTimer();
  setupMobileBackIntent();

  ["click", "mousemove", "scroll", "touchstart", "keypress"].forEach((evt) => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  document.addEventListener("mouseleave", (e) => {
    if (e.clientY < 0) triggerAbandonmentModal();
  });
});
