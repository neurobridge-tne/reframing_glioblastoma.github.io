# Reframing Glioblastoma

Website of the workshop "Reframing Glioblastoma: Integrating Tumor Biology, Microenvironment and Clinical Perspectives".
Plain HTML/CSS/JS: no build step, works as-is on GitHub Pages.

## Structure

```
index.html            the whole site (one page, sections: about, speakers, program, register, venue, contact)
assets/style.css      colors and fonts are at the top (:root)
assets/site.js        sliding highlight in the menu
assets/register.js    registration form (validation, 300-word limit, sending)
assets/hero-gbm.jpg   header image: simulated H&E micrograph (regenerate with gen/he.py)
registration/         the registration page
registration-backend/ Google Apps Script that stores registrations and sends the confirmation email,
                      with setup instructions (SETUP-REGISTRATION.md)
assets/fonts/         self-hosted fonts (no Google requests)
assets/speakers/      speaker photos, square, 480x480 jpg
program/ directions/ contacts/ flyer/
                      tiny redirect pages so old links still work
```

## Common edits

- **Dates, place, streaming link**: the `<header class="hero">` block in `index.html`.
- **Add a talk**: copy a `<li class="slot" id="talk-...">` in the Program section.
- **Add a break**: copy a `<li class="slot slot--break">`.
- **Add a speaker**: copy a `<li>` in the Speakers section; its `href` must match the talk's `id`.
- **Speaker photo**: square crop, about 480x480 px, under 60 KB, saved in `assets/speakers/`.

## Custom domain

Settings → Pages → Custom domain. Then at your registrar point A records to
185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
and a `www` CNAME to `<user>.github.io`.
