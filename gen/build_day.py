"""Builds day/index.html, the mobile program page reached by the QR code,
from the program in index.html. Run it again after changing the program:

    python3 gen/build_day.py
"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
home = (root / "index.html").read_text(encoding="utf-8")

start = home.index('<ol class="program">')
end = home.index("</ol>", start) + len("</ol>")
program = home[start:end]
program = program.replace('src="assets/', 'src="../assets/')
program = program.replace('loading="lazy"', 'loading="lazy" width="44" height="44"')

v = re.search(r'assets/style\.css\?v=([\w]+)', home)
ver = v.group(1) if v else "1"

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#1F7A55">
  <title>Program · Reframing Glioblastoma</title>
  <link rel="icon" type="image/png" href="../assets/favicon.png">
  <link rel="stylesheet" href="../assets/style.css?v={ver}">
  <link rel="stylesheet" href="day.css?v={ver}">
</head>
<body class="day">

<header class="day-head">
  <p class="day-kicker">Thursday 18 February 2027</p>
  <h1>Reframing Glioblastoma</h1>
  <p class="day-where">Building A, Room 27, ground floor<br>CNR Research Area, Via Giuseppe Moruzzi 1, Pisa</p>
</header>

<!-- filled in by the script below on the day of the event -->
<section class="now" id="now" hidden aria-live="polite">
  <div class="now__row" id="now-current"></div>
  <div class="now__row now__row--next" id="now-next"></div>
</section>

<main class="day-main">
{program}
</main>

<footer class="day-foot">
  <a class="btn" href="https://www.google.com/maps/search/?api=1&amp;query=Area+della+Ricerca+CNR+Via+Giuseppe+Moruzzi+1+Pisa">Open the venue in Maps</a>
  <a class="btn btn--ghost" href="program.pdf" download>Download the program (PDF)</a>
  <p><a href="../">Workshop website</a></p>
</footer>

<script>
/* Highlights the talk in progress and the next one, using Pisa time (CET).
   Works only on the day of the event; on other days the page is a plain program. */
(function () {{
  const EVENT_DAY = "2027-02-18";
  const rows = [...document.querySelectorAll(".program [data-start]")];
  const box = document.getElementById("now");
  const cur = document.getElementById("now-current"), nxt = document.getElementById("now-next");
  const label = (r) => {{
    const sp = r.querySelector(".speaker");
    const name = sp ? sp.childNodes[0].textContent.trim() : (r.querySelector(".slot__body p") || {{}}).textContent;
    return `<span class="now__time">${{r.dataset.start}}–${{r.dataset.end}}</span> <span class="now__what">${{name}}</span>`;
  }};
  function pisaNow() {{
    const p = new Intl.DateTimeFormat("en-CA", {{ timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false }}).formatToParts(new Date());
    const g = (t) => p.find((x) => x.type === t).value;
    return {{ day: `${{g("year")}}-${{g("month")}}-${{g("day")}}`, min: (+g("hour") % 24) * 60 + +g("minute") }};
  }}
  const m = (t) => {{ const [h, mm] = t.split(":").map(Number); return h * 60 + mm; }};
  function update() {{
    rows.forEach((r) => r.classList.remove("is-now"));
    const n = pisaNow();
    if (n.day !== EVENT_DAY) {{ box.hidden = true; return; }}
    const now = rows.find((r) => m(r.dataset.start) <= n.min && n.min < m(r.dataset.end));
    const next = rows.find((r) => m(r.dataset.start) > n.min);
    if (!now && !next) {{ box.hidden = true; return; }}
    box.hidden = false;
    cur.innerHTML = now ? "<b>Now</b> " + label(now) : "<b>Now</b> <span class=\\"now__what\\">Break</span>";
    nxt.innerHTML = next ? "<b>Next</b> " + label(next) : "";
    if (now) now.classList.add("is-now");
  }}
  update();
  setInterval(update, 30000);
  // on the day, open the page at the talk in progress
  const live = document.querySelector(".is-now");
  if (live) live.scrollIntoView({{ block: "center" }});
}})();
</script>
</body>
</html>
'''
(root / "day").mkdir(exist_ok=True)
(root / "day" / "index.html").write_text(page, encoding="utf-8")
print("written day/index.html")
