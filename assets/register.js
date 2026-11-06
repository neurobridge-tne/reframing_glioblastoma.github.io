/* Registration form.
   Sends the answers to a Google Apps Script web app, which saves them in a
   Google Sheet and emails the confirmation. Setup: see SETUP-REGISTRATION.md */

// Paste here the Web app URL you get when you deploy the script (ends with /exec)
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzBUDYA7tH6kMVxJnwS8lOMnXyMKr1i4kTwBvW6uFTcOOH1ZDho_2dYLBUdlweIZjyA_w/exec";

const MAX_WORDS = 300;
const MIN_SECONDS = 4;            // must match MIN_SECONDS in Code.gs
const openedAt = Date.now();

(function () {
  const form = document.getElementById("reg");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const abstractBox = $("abstract-box"), abstract = $("abstract"), counter = $("abstract-count");
  const status = $("status"), submit = $("submit");

  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

  function updateCounter() {
    const n = words(abstract.value);
    counter.textContent = `${n} / ${MAX_WORDS} words`;
    counter.classList.toggle("is-over", n > MAX_WORDS);
  }
  abstract.addEventListener("input", () => { updateCounter(); clear("abstract"); });

  // Lunch and posters only concern people attending in person
  const inPerson = $("in-person");
  form.querySelectorAll('input[name="attendance"]').forEach((r) =>
    r.addEventListener("change", () => {
      inPerson.hidden = form.attendance.value !== "In person";
    })
  );

  form.querySelectorAll('input[name="poster"]').forEach((r) =>
    r.addEventListener("change", () => {
      const yes = form.poster.value === "Yes";
      abstractBox.hidden = !yes;
      abstract.required = yes;
      if (yes) abstract.focus();
    })
  );

  function setError(name, msg) {
    const el = $(name + "-err");
    if (el) el.textContent = msg;
    const input = form.elements[name];
    if (input && input.setAttribute) input.setAttribute("aria-invalid", "true");
  }
  function clear(name) {
    const el = $(name + "-err");
    if (el) el.textContent = "";
    const input = form.elements[name];
    if (input && input.removeAttribute) input.removeAttribute("aria-invalid");
  }
  ["firstName", "lastName", "email", "affiliation", "consent"].forEach((n) =>
    form.elements[n].addEventListener("input", () => clear(n)));
  form.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener("change", () => clear(r.name)));

  function validate() {
    let first = null;
    const fail = (name, msg) => { setError(name, msg); if (!first) first = name; };
    const v = (n) => form.elements[n].value.trim();
    if (!v("firstName")) fail("firstName", "Enter your first name.");
    if (!v("lastName")) fail("lastName", "Enter your last name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email"))) fail("email", "Enter an email address like name@university.edu.");
    if (!v("affiliation")) fail("affiliation", "Enter your university or institute.");
    if (!form.attendance.value) fail("attendance", "Choose in person or online.");
    const here = form.attendance.value === "In person";
    if (here && !form.poster.value) fail("poster", "Choose whether you'll present a poster.");
    if (here && form.poster.value === "Yes") {
      const n = words(abstract.value);
      if (!n) fail("abstract", "Paste your abstract, or choose No above.");
      else if (n > MAX_WORDS) fail("abstract", `Your abstract is ${n} words. Shorten it to ${MAX_WORDS} or fewer.`);
    }
    if (!form.consent.checked) fail("consent", "Tick the box so we can store your registration.");
    if (first) {
      const el = form.elements[first];
      (el.length ? el[0] : el).focus();
    }
    return !first;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = ""; status.classList.remove("is-error");
    if (!validate()) return;

    const data = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      affiliation: form.affiliation.value.trim(),
      attendance: form.attendance.value,
      dietary: form.attendance.value === "In person" ? form.dietary.value.trim() : "",
      poster: form.attendance.value === "In person" ? form.poster.value : "No",
      abstract: form.attendance.value === "In person" && form.poster.value === "Yes" ? abstract.value.trim() : "",
      website: form.website.value,   // spam trap
      elapsed: Date.now() - openedAt,
    };

    // A person can't fill this in a few seconds; a bot can.
    if (data.elapsed < MIN_SECONDS * 1000) {
      status.textContent = "Please check your details, then press Register again.";
      status.classList.add("is-error");
      return;
    }

    if (!ENDPOINT) {
      status.textContent = "Registration isn't connected yet: the organizers still need to add the form address.";
      status.classList.add("is-error");
      return;
    }

    submit.disabled = true; submit.textContent = "Registering…";
    try {
      // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin
      const res = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(data) });
      const out = await res.json();
      if (!out.ok) {
        const e = new Error(out.error || "rejected"); e.code = out.error; throw e;
      }
      $("done-email").textContent = data.email;
      if (out.emailSent === false) {
        $("done-msg").textContent = "Your registration is saved, but we couldn't send the confirmation email. You don't need to register again: the organizers will contact you.";
      }
      form.hidden = true;
      $("done").hidden = false;
      $("done").focus();
      window.scrollTo({ top: $("done").getBoundingClientRect().top + window.scrollY - 120 });
    } catch (err) {
      const msgs = {
        limit: "This email has already been used for 2 registrations. To change your details, email the organizing committee (link at the bottom of the page).",
        too_fast: "Please check your details, then press Register again.",
      };
      status.textContent = msgs[err.code] || "Your registration didn't go through. Check your connection and try again. If it keeps failing, email the organizing committee (link at the bottom of the page).";
      if (err.code === "limit") setError("email", "Already used for 2 registrations.");
      status.classList.add("is-error");
      submit.disabled = false; submit.textContent = "Register";
    }
  });
})();
