/* Registration form.
   Sends the answers to a Google Apps Script web app, which saves them in a
   Google Sheet and emails the confirmation. Setup: see SETUP-REGISTRATION.md */

// Paste here the Web app URL you get when you deploy the script (ends with /exec)
const ENDPOINT = "";

const MAX_WORDS = 300;

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
    if (!form.poster.value) fail("poster", "Choose whether you'll present a poster.");
    if (form.poster.value === "Yes") {
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
      poster: form.poster.value,
      abstract: form.poster.value === "Yes" ? abstract.value.trim() : "",
      website: form.website.value,   // spam trap
    };

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
      if (!out.ok) throw new Error(out.error || "rejected");
      $("done-email").textContent = data.email;
      form.hidden = true;
      $("done").hidden = false;
      $("done").focus();
      window.scrollTo({ top: $("done").getBoundingClientRect().top + window.scrollY - 120 });
    } catch (err) {
      status.textContent = "Your registration didn't go through. Check your connection and try again. If it keeps failing, email gabriele.coluccia@santannapisa.it.";
      status.classList.add("is-error");
      submit.disabled = false; submit.textContent = "Register";
    }
  });
})();
