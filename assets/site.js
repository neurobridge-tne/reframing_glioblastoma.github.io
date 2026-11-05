/* Nav: a box that slides to the section you are reading.
   On pages that are not sections of the home (e.g. registration),
   the link marked aria-current="page" gets the box. */
(function () {
  const nav = document.querySelector(".nav");
  const bar = document.querySelector(".nav__links");
  const pill = document.querySelector(".nav__pill");
  if (!nav || !bar || !pill) return;

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const links = [...bar.querySelectorAll("a")];
  let current = null;

  function place(a, instant) {
    current = a;
    links.forEach((l) => l.classList.toggle("is-active", l === a));
    if (!a) { pill.style.opacity = 0; return; }
    if (instant) pill.style.transition = "none";
    pill.style.opacity = 1;
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
    if (instant) { pill.offsetWidth; pill.style.transition = ""; }
    // on phones the menu scrolls sideways: keep the active item visible
    if (bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: instant ? "auto" : "smooth" });
    }
  }

  const fixed = bar.querySelector('[aria-current="page"]');
  if (fixed) {
    place(fixed, true);
  } else {
    const byId = new Map();
    links.forEach((a) => {
      const h = a.getAttribute("href") || "";
      if (h.startsWith("#")) byId.set(h.slice(1), a);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) place(byId.get(en.target.id) || null); });
    }, { rootMargin: "-45% 0px -54% 0px" });
    document.querySelectorAll("header[id], section[id]").forEach((el) => io.observe(el));
  }

  window.addEventListener("resize", () => place(current, true));
  if (document.fonts) document.fonts.ready.then(() => place(current, true));
})();

