/* ================= UTILITIES ================= */
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
let bloomData = window.BLOOM_DATA || {};

function setBloomWatermarkRemoved(removeWatermark) {
  document.body.classList.toggle("bloom-watermark-removed", removeWatermark === true);
}

setBloomWatermarkRemoved(window.BLOOM_REMOVE_WATERMARK === true);

function bloomValue(key, fallback = "") {
  const value = bloomData[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function bloomList(key, fallback) {
  return Array.isArray(bloomData[key]) ? bloomData[key] : fallback;
}

function safeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function safeMediaUrl(value) {
  const url = String(value ?? "").trim();
  return /^(https?:\/\/|\/|\.\/|images\/|videos\/|music\/)/i.test(url)
    ? url
    : "";
}

function setBloomText(selector, key, fallback) {
  const element = $(selector);
  if (element) element.textContent = bloomValue(key, fallback);
}

function setBloomParagraph(selector, key, fallback) {
  const element = $(selector);
  if (!element) return;
  element.innerHTML = safeHtml(bloomValue(key, fallback)).replace(/\n/g, "<br>");
}

function renderFuturePlans() {
  const grid = $("#future-plans .fp-grid");
  if (!grid || !Array.isArray(bloomData.futurePlans)) return;
  grid.replaceChildren();
  bloomList("futurePlans", []).forEach((plan) => {
    const card = document.createElement("div");
    card.className = "fp-card";
    const title = document.createElement("h3");
    title.textContent = String(plan.title || "A dream for us");
    const message = document.createElement("p");
    message.textContent = String(plan.text || "A beautiful plan waiting to happen.");
    card.append(title, message);
    card.addEventListener("click", () => card.classList.toggle("open"));
    grid.appendChild(card);
  });
}

function renderStats() {
  const grid = $("#lovestats .stats-grid");
  if (!grid || !Array.isArray(bloomData.stats)) return;
  grid.replaceChildren();
  bloomData.stats.forEach((stat, index) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    if (index === bloomData.stats.length - 1 && bloomData.stats.length > 4) {
      card.style.gridColumn = "span 2";
    }
    const icon = document.createElement("div");
    icon.className = "stat-icon";
    icon.textContent = String(stat.icon || "♡");
    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = String(stat.value || "∞");
    const label = document.createElement("div");
    label.className = "stat-name";
    label.textContent = String(stat.label || "Little things");
    card.append(icon, value, label);
    grid.appendChild(card);
  });
}

function applyBloomText() {
  const recipient = bloomValue("name", "Vansh");
  const passcodeTitle = bloomValue("passcodeTitle", "Happy Anniversary {name} ♡").replace(/\{name\}/g, recipient);
  document.title = bloomValue("pageTitle", `Our ${bloomValue("anniversaryNumber", "1")}${bloomValue("anniversarySuffix", "st")} Anniversary ♡`);
  setBloomText(".intro-text", "introLoadingMessage", "Loading our memories...");
  setBloomText(".pc-heading", "passcodeTitle", passcodeTitle);
  setBloomText(".pc-sub", "passcodeMessage", "A love only we know the code to");
  setBloomText(".pc-error", "passcodeError", "Try again, my love ♡");
  setBloomText("#bloom-transition .bloom-center", "bloomTransitionMessage", "Our story begins...");

  const welcomeTitle = $("#welcome h1");
  if (welcomeTitle?.firstChild) welcomeTitle.firstChild.nodeValue = `${bloomValue("introTitle", "Hello Beautiful")} `;
  setBloomParagraph("#welcome .welcome-card p", "introMessage", "I made something only for you. Every scroll contains another memory.\nTake your time.");
  setBloomText("#bloomStoryBtn", "introButton", "Bloom Our Story");

  setBloomText("#hero .hero-eyebrow", "heroEyebrow", "Happy");
  const heroTitle = $("#hero .hero-title");
  if (heroTitle) {
    if (heroTitle.firstChild) heroTitle.firstChild.nodeValue = bloomValue("anniversaryNumber", "1");
    const suffix = heroTitle.querySelector(".gold");
    if (suffix) suffix.textContent = bloomValue("anniversarySuffix", "st");
    if (heroTitle.lastChild) heroTitle.lastChild.nodeValue = ` ${bloomValue("anniversaryLabel", "Anniversary")}`;
  }
  setBloomText("#hero .hero-love", "heroSubtitle", "My Love");
  setBloomText("#hero .hero-date", "heroDate", "25 · JUNE · 2026");
  setBloomText("#hero .hero-forever", "heroFooter", "Forever");

  setBloomText("#timeline .eyebrow", "timelineEyebrow", "The Journey");
  setBloomText("#timeline .big-heading", "timelineTitle", "Our Timeline");
  setBloomText("#timeline .sub-heading", "timelineSubtitle", "2025 to today, and always");
  setBloomText("#threeyears .eyebrow", "yearsEyebrow", "Since 25 June 2025");
  setBloomText("#threeyears .big-heading", "yearsTitle", "1 Years of Us");
  ["daysCounterLabel", "hoursCounterLabel", "minutesCounterLabel", "memoriesCounterLabel"].forEach((key, index) => {
    const labels = $$("#threeyears .counter-label");
    const fallbacks = ["Days", "Hours", "Minutes", "Memories"];
    if (labels[index]) labels[index].textContent = bloomValue(key, fallbacks[index]);
  });

  setBloomText("#lovestats .eyebrow", "statsEyebrow", "Little Numbers, Big Love");
  setBloomText("#lovestats .big-heading", "statsTitle", "Love Stats");
  setBloomText("#gallery .eyebrow", "galleryEyebrow", "Our Little Universe");
  setBloomText("#gallery .big-heading", "galleryTitle", "Pinterest Gallery");
  setBloomText("#letters .eyebrow", "lettersEyebrow", "Words From The Heart");
  setBloomText("#letters .big-heading", "lettersTitle", "Letters To You");
  setBloomText("#jar-section .eyebrow", "reasonsEyebrow", "100 Reasons");
  setBloomText("#jar-section .big-heading", "reasonsTitle", "Memory Jar");
  const jarCount = $("#jarCount");
  if (jarCount?.nextSibling) {
    jarCount.nextSibling.textContent = ` ${bloomValue("reasonsCountLabel", "reasons left to discover")}`;
  }
  setBloomText("#cake-section .eyebrow", "cakeEyebrow", "Make A Wish");
  setBloomText("#cake-section .big-heading", "cakeTitle", "Our Cake");
  setBloomText(".cake-hint", "cakeHint", "Tap each candle to light it");
  setBloomText("#cakeMsg", "cakeMessage", "Happy Anniversary");
  setBloomText("#music-section .eyebrow", "musicEyebrow", "Our Soundtrack");
  setBloomText("#music-section .big-heading", "musicTitle", "Music For Us");
  setBloomText("#rotgallery .eyebrow", "rotatingEyebrow", "Spin Through Us");
  setBloomText("#rotgallery .big-heading", "rotatingTitle", "Rotating Gallery");
  setBloomText(".rot-hint", "rotatingHint", "Drag to rotate");

  setBloomText("#movie-night .eyebrow", "movieEyebrow", "Movie Night");
  setBloomText("#movie-night .big-heading", "movieTitle", "A Film About Us");
  setBloomText(".movie-sub", "movieDescription", "Every love story deserves the biggest screen.");
  setBloomText(".movie-ticket", "movieTicket", "🍿 Movie Night • Reserved For Two • Forever");
  const movieSection = $("#movie-night");
  if (movieSection) movieSection.hidden = bloomData.movieEnabled !== true;
  const movie = $("#loveMovie");
  const movieSource = movie?.querySelector("source");
  if (movieSource) {
    const video = safeMediaUrl(bloomData.movieVideo || "videos/movie.mp4");
    if (video && movieSource.getAttribute("src") !== video) {
      movieSource.setAttribute("src", video);
      movie.load();
    }
  }
  if (movie) movie.poster = safeMediaUrl(bloomData.moviePoster || "images/i1.jpg");

  setBloomText("#scratch-section .eyebrow", "scratchEyebrow", "One More Surprise");
  setBloomText("#scratch-section .big-heading", "scratchTitle", "Scratch To Reveal");
  setBloomParagraph(".scratch-sub", "scratchInstruction", "Scratch away the golden foil to reveal your surprise ❤️");
  setBloomText(".scratch-hidden h3", "scratchRewardTitle", "I Love You Forever ❤️");
  setBloomParagraph(".scratch-hidden p", "scratchMessage", "Thank you for making every day feel magical.");
  const scratchImage = $(".scratch-hidden img");
  if (scratchImage) scratchImage.src = safeMediaUrl(bloomData.scratchImage || "images/i1.jpg");

  setBloomText("#puzzle-section .eyebrow", "puzzleEyebrow", "One Last Challenge");
  setBloomText("#puzzle-section .big-heading", "puzzleTitle", "Complete Our Memory");
  setBloomParagraph(".puzzle-sub", "puzzleInstruction", "Rearrange the pieces to reveal our favorite photo ❤️");
  setBloomText("#puzzleDone", "puzzleSolvedMessage", "❤️ You completed our memory ❤️");
  setBloomText("#countdown-section .eyebrow", "countdownEyebrow", "What's Next");
  setBloomText("#countdown-section .big-heading", "countdownTitle", "Countdown To Our Next Anniversary");
  ["countdownDaysLabel", "countdownHoursLabel", "countdownMinutesLabel", "countdownSecondsLabel"].forEach((key, index) => {
    const labels = $$("#countdown-section .cd-label");
    const fallbacks = ["Days", "Hours", "Minutes", "Seconds"];
    if (labels[index]) labels[index].textContent = bloomValue(key, fallbacks[index]);
  });

  setBloomText("#secretlock > .eyebrow", "finalEyebrow", "One Last Lock");
  setBloomText("#secretlock > .big-heading", "finalTitle", "Only You Can Unlock It");
  const unlockInput = $("#slInput");
  if (unlockInput) unlockInput.placeholder = bloomValue("finalPlaceholder", "Type your name...");
  setBloomText("#slBtn", "finalButton", "Unlock");
  setBloomText("#slError", "finalError", "That's not quite it, try again ♡");
  setBloomText("#future-plans .eyebrow", "futureEyebrow", "Our Future");
  setBloomText("#future-plans .big-heading", "futureTitle", "Future Plans");

  const closingSignature = bloomValue("closingSignature").trim() ||
    `♡ Happy Anniversary, ${bloomValue("senderName", "My Love")}`;
  const closingSignatureElement = $(".end-script");
  if (closingSignatureElement) closingSignatureElement.textContent = closingSignature;
  setBloomParagraph(".end-msg", "closingMessage", "Thank you\nfor choosing me\nevery single day.");
  setBloomText("#replayBtn", "replayButtonLabel", "Replay Our Story");
  setBloomText(".credit", "footerMessage", "@_devsphere__");
  const titleInput = $(".pc-heading");
  if (titleInput) titleInput.textContent = passcodeTitle;
  const secretPlans = $("#future-plans");
  if (secretPlans) secretPlans.querySelector(".big-heading")?.style.setProperty("color", "#fff");
  renderFuturePlans();
  renderStats();
}

applyBloomText();

/* ================= HEART CURSOR TRAIL ================= */
let lastHeart = 0;
document.addEventListener("mousemove", (e) => {
  const now = Date.now();
  if (now - lastHeart < 60) return;
  lastHeart = now;
  const h = document.createElement("div");
  h.className = "heart-trail";
  h.textContent = "♡";
  h.style.left = e.clientX - 6 + "px";
  h.style.top = e.clientY - 6 + "px";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 1000);
});

/* ================= PETAL CANVAS (global floating petals) ================= */
const canvas = $("#petal-canvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
const petals = [];
const PETAL_COLORS = ["#C393A3", "#E7C8CF", "#7D4E6E", "#E6C96D"];
for (let i = 0; i < 26; i++) {
  petals.push({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 4 + Math.random() * 6,
    speedY: 0.3 + Math.random() * 0.6,
    speedX: Math.sin(i) * 0.4,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 1.2,
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    sway: Math.random() * Math.PI * 2,
  });
}
function drawPetal(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rot * Math.PI) / 180);
  ctx.fillStyle = p.color;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r, p.r * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function animatePetals() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  petals.forEach((p) => {
    p.sway += 0.01;
    p.y += p.speedY;
    p.x += Math.sin(p.sway) * 0.6;
    p.rot += p.rotSpeed;
    if (p.y > innerHeight + 20) {
      p.y = -20;
      p.x = Math.random() * innerWidth;
    }
    drawPetal(p);
  });
  requestAnimationFrame(animatePetals);
}
animatePetals();

/* ================= INTRO ================= */
window.addEventListener("load", () => {
  setTimeout(() => {
    $("#intro").classList.add("hide");
  }, 2400);
});

/* ================= PASSCODE ================= */
let CODE = bloomValue("passcodeCode", "250626");
let entered = "";
const dotsEls = $$(".pc-dot");
const keysWrap = $("#pc-keys");
["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].forEach((k) => {
  const b = document.createElement("div");
  b.className = "pc-key";
  b.textContent = k;
  b.addEventListener("click", () => handleKey(k));
  keysWrap.appendChild(b);
});
function updateDots() {
  dotsEls.forEach((d, i) => d.classList.toggle("filled", i < entered.length));
}
function handleKey(k) {
  if (k === "⌫") {
    entered = entered.slice(0, -1);
    updateDots();
    return;
  }
  if (k === "✓") {
    checkCode();
    return;
  }
  if (entered.length >= 6) return;
  entered += k;
  updateDots();
  if (entered.length === 6) setTimeout(checkCode, 200);
}
function checkCode() {
  if (entered === CODE) {
    correctCode();
  } else {
    const pc = $("#passcode");
    pc.classList.add("shake");
    $("#pc-error").classList.add("show");
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    setTimeout(() => {
      pc.classList.remove("shake");
      entered = "";
      updateDots();
    }, 420);
  }
}
function correctCode() {
  if (navigator.vibrate) navigator.vibrate(120);
  document
    .querySelectorAll(".pc-key")
    .forEach((b) => (b.style.pointerEvents = "none"));
  $("#passcode").classList.add("frozen");
  setTimeout(() => {
    $("#passcode").classList.add("hide");
    triggerBloom();
  }, 900);
}

/* ================= FLOWER BLOOM TRANSITION ================= */
function triggerBloom() {
  const bt = $("#bloom-transition");
  bt.innerHTML = `<div class="bloom-center script">${safeHtml(bloomValue("bloomTransitionMessage", "Our story begins..."))}</div>`;
  // create 4 corner flowers
  const positions = [
    { top: "-10%", left: "-10%" },
    { top: "-10%", right: "-10%" },
    { bottom: "-10%", left: "-10%" },
    { bottom: "-10%", right: "-10%" },
  ];
  positions.forEach((pos, i) => {
    const f = document.createElement("div");
    f.className = "bloom-flower";
    Object.assign(f.style, pos);
    f.innerHTML =
      '<div style="font-size:220px;filter:drop-shadow(0 0 30px rgba(212,175,55,.4));"><img src="images/flower.png" alt="flower"></div>';
    bt.appendChild(f);
    setTimeout(() => {
      f.style.transition = "all 1.1s cubic-bezier(.2,.9,.3,1)";
      f.style.opacity = "1";
      f.style.transform = "scale(1.1) rotate(" + (i % 2 ? 15 : -15) + "deg)";
    }, 120 * i);
  });
  setTimeout(() => {
    $(".bloom-center").style.transition = "opacity 1s ease";
    $(".bloom-center").style.opacity = "1";
  }, 500);
  bt.classList.add("active");
  startMusic();
  setTimeout(() => {
    bt.classList.remove("active");
    document.body.style.overflow = "auto";
    $("#welcome").classList.add("visible");
  }, 2400);
}

/* start with body scroll locked until unlocked */
document.body.style.overflow = "hidden";

/* ================= SCROLL REVEAL ================= */
const revealEls = $$(".reveal, .tl-card, .ls-item");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.2 },
);
revealEls.forEach((el) => io.observe(el));

/* Welcome -> Hero scroll button */
$("#bloomStoryBtn").addEventListener("click", () => {
  $("#hero").scrollIntoView({ behavior: "smooth" });
});

/* ================= TIMELINE CARDS ================= */
const defaultTimelineData = [
  {
    year: "2025",
    title: "The First Hello",
    text: "A conversation that was supposed to be short turned into hours. Something in me already knew.",
    img: '<img src="images/i1.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "First Meet",
    text: "A conversation that was supposed to be short turned into hours. Something in me already knew.",
    img: '<img src="images/i5.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Falling Deeper",
    text: "Every ordinary day started feeling like an adventure, simply because you were in it.",
    img: '<img src="images/i2.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Proposal",
    text: "Every ordinary day started feeling like an adventure, simply because you were in it.",
    img: '<img src="images/i6.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "First Trip",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i8.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Relationship",
    text: "Every ordinary day started feeling like an adventure, simply because you were in it.",
    img: '<img src="images/i7.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Building Us",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i3.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Engagement",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i9.jpg" alt="timeline-photo">',
  },
  {
    year: "2025",
    title: "Marriage",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i10.jpg" alt="timeline-photo">',
  },
  {
    year: "2026",
    title: "Anniversary",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i11.jpg" alt="timeline-photo">',
  },
  {
    year: "2026",
    title: "Today",
    text: "Still here. Still us. Still choosing this love, again and again.",
    img: '<img src="images/i4.jpg" alt="timeline-photo">',
  },
  {
    year: "2026",
    title: "To Be Continued",
    text: "We learned each other fully — the good mornings, the hard days, and everything between.",
    img: '<img src="images/i12.jpg" alt="timeline-photo">',
  },

];
function normalizedTimeline(items) {
  return items.map((item) => ({
    year: String(item.year || "2025"),
    title: String(item.title || "A memory to keep"),
    text: String(item.text || item.description || "A little moment that became a memory."),
    image: safeMediaUrl(item.image || item.img?.match(/src=["']([^"']+)/)?.[1]),
  }));
}
let timelineData = normalizedTimeline(bloomList("timeline", defaultTimelineData));
const tlCardsWrap = $("#tl-cards");
function renderTimelineCards() {
  tlCardsWrap.replaceChildren();
  timelineData.forEach((item) => {
    const card = document.createElement("div");
    card.className = "tl-card reveal";
    const photo = item.image
      ? `<img src="${safeHtml(item.image)}" alt="timeline-photo">`
      : "♡";
    card.innerHTML = `
      <div class="tl-photo"><div class="ph-inner">${photo}</div></div>
      <div class="tl-text">
        <div class="tl-year">${safeHtml(item.year)}</div>
        <h3>${safeHtml(item.title)}</h3>
        <p>${safeHtml(item.text)}</p>
      </div>`;
    tlCardsWrap.appendChild(card);
    io.observe(card);
  });
}
renderTimelineCards();

/* draw timeline SVG path on scroll */
const tlPath = $("#tl-path");
const pathLength = tlPath.getTotalLength();
tlPath.style.strokeDasharray = pathLength;
tlPath.style.strokeDashoffset = pathLength;
function updateTimelinePath() {
  const wrap = $("#timeline");
  const rect = wrap.getBoundingClientRect();
  const total = rect.height + innerHeight;
  const progress = Math.min(Math.max((innerHeight - rect.top) / total, 0), 1);
  tlPath.style.strokeDashoffset = pathLength * (1 - progress);
}
window.addEventListener("scroll", updateTimelinePath);
updateTimelinePath();

/* ================= LOVE STORY MILESTONES ================= */

// const milestones = [
//   {
//     title: "First Meet",
//     image: "images/i5.jpg",
//   },
//   {
//     title: "Proposal",
//     image: "images/i6.jpg",
//   },
//   {
//     title: "Relationship",
//     image: "images/i7.jpg",
//   },
//   {
//     title: "First Trip",
//     image: "images/i8.jpg",
//   },
//   {
//     title: "Engagement",
//     image: "images/i9.jpg",
//   },
//   {
//     title: "Marriage",
//     image: "images/i10.jpg",
//   },
//   {
//     title: "Anniversary",
//     image: "images/i11.jpg",
//   },
//   {
//     title: "To Be Continued",
//     image: "images/i12.jpg",
//   },
// ];

// const lsWrap = $("#ls-path");

// milestones.forEach((item) => {
//   const div = document.createElement("div");
//   div.className = "ls-item reveal";

//   div.innerHTML = `
//     <span class="ls-dot"></span>

//     <div class="ls-polaroid">
//       <div class="ph"><img src="${item.image}" alt="${item.title}" class="ls-photo"></div>
//         <div class="ls-label">${item.title}</div>
//     </div>`;

//   lsWrap.appendChild(div);
// });

// $$(".ls-item").forEach((el) => io.observe(el));

/* ================= COUNTERS ================= */
const counterEls = $$(".counter-num[data-target]");
let countersDone = false;
const counterIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && !countersDone) {
        countersDone = true;
        counterEls.forEach((el) => {
          const target = +el.dataset.target;
          let cur = 0;
          const step = Math.max(1, Math.floor(target / 120));
          const t = setInterval(() => {
            cur += step;
            if (cur >= target) {
              cur = target;
              clearInterval(t);
            }
            el.textContent = cur.toLocaleString();
          }, 16);
        });
      }
    });
  },
  { threshold: 0.4 },
);
if ($("#threeyears")) counterIO.observe($("#threeyears"));

/* ================= PINTEREST GALLERY ================= */
const defaultGalleryData = [
  {
    h: 260,
    cap: "That golden evening",
    img: "images/i13.jpg",
  },
  {
    h: 340,
    cap: "Us, always",
    img: "images/i14.jpg",
  },
  {
    h: 220,
    cap: "Coffee & you",
    img: "images/i15.jpg",
  },
  {
    h: 300,
    cap: "Our first trip",
    img: "images/i8.jpg",
  },
  {
    h: 250,
    cap: "Laughing too hard",
    img: "images/i17.jpg",
  },
  {
    h: 360,
    cap: "Rainy day walk",
    img: "images/i18.jpg",
  },
  {
    h: 230,
    cap: "Home is you",
    img: "images/i19.jpg",
  },
  {
    h: 280,
    cap: "Midnight talks",
    img: "images/i20.jpg",
  },
  {
    h: 310,
    cap: "That little cafe",
    img: "images/i21.jpg",
  },
  {
    h: 240,
    cap: "Forever kind of love",
    img: "images/i22.jpg",
  },
  {
    h: 270,
    cap: "Just us",
    img: "images/i23.jpg",
  },
  {
    h: 320,
    cap: "Sunset chasers",
    img: "images/i24.jpg",
  },
];
function normalizedGallery(items) {
  const originalHeights = [260, 340, 220, 300, 250, 360, 230, 280, 310, 240, 270, 320];
  return items.map((item, index) => ({
    h: Number(item.h || item.height || originalHeights[index % originalHeights.length]),
    cap: String(item.cap || item.caption || `Memory ${index + 1}`),
    img: safeMediaUrl(item.img || item.image),
  }));
}
let galleryData = normalizedGallery(bloomList("photos", defaultGalleryData));
const masonry = $("#masonry");
function renderGallery() {
  masonry.replaceChildren();
  galleryData.forEach((g) => {
    const item = document.createElement("div");
    item.className = "gal-item";
    item.innerHTML = `
      <div class="tape"></div>
      <div class="gal-img" style="height:${Math.max(140, Math.min(g.h, 500))}px">
        ${g.img ? `<img src="${safeHtml(g.img)}" alt="${safeHtml(g.cap)}">` : "♡"}
      </div>
      <div class="gal-cap script">${safeHtml(g.cap)}</div>`;
    item.addEventListener("click", () => openLightbox(g.img, g.cap));
    masonry.appendChild(item);
  });
}
renderGallery();
function openLightbox(img, cap) {
  $("#lightbox-img").innerHTML = `
        ${img ? `<img src="${safeHtml(img)}" alt="${safeHtml(cap)}">` : ""}
        <div class="lightbox-caption">${safeHtml(cap)}</div>
    `;

  $("#lightbox").classList.add("active");
}
$("#lightbox-close").addEventListener("click", () =>
  $("#lightbox").classList.remove("active"),
);
$("#lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") $("#lightbox").classList.remove("active");
});

/* ================= LETTERS ================= */
const defaultLettersData = [
  {
    title: "To My Best Friend",
    body: 'From the very first day, you felt like home. Thank you for every laugh, every quiet moment, and every "I love you" that still makes my heart skip. one years in, and I fall for you a little more each morning.',
  },
  {
    title: "To My Forever",
    body: "I used to wonder what forever meant until I met you. Now I know — it means choosing you, again and again, on the easy days and the hard ones. You are my favorite person and my favorite place.",
  },
  {
    title: "To My Future",
    body: "There is so much more ahead of us — more cities, more mornings, more inside jokes. Whatever comes, I only want to face it with you beside me. Here is to everything we have not lived yet.",
  },
];
function normalizedLetters(items) {
  return items.map((letter, index) => ({
    title: String(letter.title || `A letter for you ${index + 1}`),
    body: String(letter.body || letter.text || "A letter from my heart to yours."),
  }));
}
let lettersData = normalizedLetters(bloomList("letters", defaultLettersData));
const envWrap = $("#envelopes");
function renderLetters() {
  envWrap.replaceChildren();
  lettersData.forEach((letter) => {
    const envelope = document.createElement("div");
    envelope.className = "envelope";
    envelope.innerHTML = `
      <div class="env-body"><div class="env-title">${safeHtml(letter.title)}</div></div>
      <div class="env-flap"><div class="env-seal">♡</div></div>`;
    envelope.addEventListener("click", () => {
      envelope.classList.add("open");
      setTimeout(() => openLetter(letter), 350);
    });
    envWrap.appendChild(envelope);
  });
}
renderLetters();
function openLetter(l) {
  $("#letter-title").textContent = l.title || bloomValue("letterModalFallbackTitle", "My Dear Love");
  $("#letter-body").textContent = l.body || bloomValue("letterModalFallbackMessage", "A letter from my heart to yours.");
  $("#letter-modal").classList.add("active");
}
$("#letter-close").addEventListener("click", () =>
  $("#letter-modal").classList.remove("active"),
);
$("#letter-modal").addEventListener("click", (e) => {
  if (e.target.id === "letter-modal")
    $("#letter-modal").classList.remove("active");
});

/* ================= MEMORY JAR ================= */
const defaultJarReasons = [
  "Because you make ordinary days feel magical.",
  "Because you remember the little things.",
  "Because your laugh is my favorite sound.",
  "Because you believe in me more than I do.",
  "Because home simply means you.",
  "Because you choose me, every single time.",
  "Because your hugs fix everything.",
  "Because you make me a better person.",
  "Because forever still feels too short with you.",
  "Because you're my safest place.",
  "Because your smile brightens my darkest days.",
  "Because you never stop believing in us.",
  "Because your kindness inspires me.",
  "Because every moment with you feels special.",
  "Because you make my heart feel at peace.",
  "Because you know exactly how to cheer me up.",
  "Because you understand me without words.",
  "Because your voice calms my soul.",
  "Because you make every adventure unforgettable.",
  "Because you're my favorite hello and hardest goodbye.",
  "Because your happiness means everything to me.",
  "Because you see the best in me.",
  "Because you're my biggest blessing.",
  "Because every memory with you becomes my favorite.",
  "Because you're my dream come true.",
  "Because your eyes feel like home.",
  "Because your love makes me fearless.",
  "Because you never let me face life alone.",
  "Because your heart is beautiful.",
  "Because you always know how to make me laugh.",
  "Because your love feels effortless.",
  "Because you inspire me to chase my dreams.",
  "Because every conversation with you matters.",
  "Because you're my greatest adventure.",
  "Because you make silence feel comfortable.",
  "Because you love me at my worst.",
  "Because you're patient with me.",
  "Because you celebrate my little victories.",
  "Because you're my favorite person.",
  "Because your love feels like sunshine.",
  "Because you never give up on us.",
  "Because you make every place feel like home.",
  "Because you're always worth waiting for.",
  "Because your hand fits perfectly in mine.",
  "Because you make my world brighter.",
  "Because you're my peace after every storm.",
  "Because you believe in forever with me.",
  "Because every day with you is a gift.",
  "Because your heart is full of love.",
  "Because you make me feel enough.",
  "Because your hugs are my favorite place.",
  "Because you understand my silence.",
  "Because you make love look easy.",
  "Because you're the reason I smile more.",
  "Because your soul is beautiful.",
  "Because you're my favorite chapter in life.",
  "Because you make me excited for tomorrow.",
  "Because your love is my greatest strength.",
  "Because you're my once-in-a-lifetime person.",
  "Because every heartbeat reminds me of you.",
  "Because you're my answered prayer.",
  "Because you make rainy days feel cozy.",
  "Because you always know the right words.",
  "Because you make my dreams feel possible.",
  "Because you never stop caring.",
  "Because you make every celebration sweeter.",
  "Because your love feels like destiny.",
  "Because you're the calm in my chaos.",
  "Because you make my heart race and rest at the same time.",
  "Because every love song reminds me of you.",
  "Because you bring out my best smile.",
  "Because you're my favorite distraction.",
  "Because you accept every imperfect part of me.",
  "Because your love never feels complicated.",
  "Because you're the reason I believe in soulmates.",
  "Because you make life more colorful.",
  "Because your support gives me courage.",
  "Because you're my greatest comfort.",
  "Because every hug feels like forever.",
  "Because your presence is enough.",
  "Because you're the best part of my story.",
  "Because you make ordinary moments unforgettable.",
  "Because you're my reason to keep going.",
  "Because I love the way you look at me.",
  "Because you're my sunshine after the rain.",
  "Because you make me feel truly loved.",
  "Because your heart feels like home.",
  "Because you're my favorite notification.",
  "Because you always make time for me.",
  "Because you're my sweetest habit.",
  "Because your love gives me hope.",
  "Because you make forever sound beautiful.",
  "Because every second with you is precious.",
  "Because you make my heart skip a beat.",
  "Because you're my best friend and my soulmate.",
  "Because you're the answer to every wish I ever made.",
  "Because you make me believe in miracles.",
  "Because your love completes me.",
  "Because I can't imagine my life without you.",
  "Because every version of my future includes you.",
  "Because no matter where life takes us, I'll always choose you."
];
function normalizedReasons(items) {
  return items.map((reason) => String(typeof reason === "string" ? reason : reason.text || ""));
}
let jarReasons = normalizedReasons(bloomList("reasons", defaultJarReasons));
let jarLeft = jarReasons.length;
let jarDiscoveries = 0;
$("#jarCount").textContent = jarLeft;
const jarHeartsWrap = $("#jarHearts");
for (let i = 0; i < 40; i++) {
  const s = document.createElement("span");
  s.textContent = "♡";
  jarHeartsWrap.appendChild(s);
}
$("#jar").addEventListener("click", () => {
  if (jarLeft <= 0) return;
  jarLeft--;
  jarDiscoveries++;
  $("#jarCount").textContent = jarLeft;
  const reason = jarReasons[Math.floor(Math.random() * jarReasons.length)];
  $("#jarNum").textContent = "Reason #" + (jarReasons.length - jarLeft);
  $("#jarText").textContent = reason;
  $("#jar-modal").classList.add("active");
});
$("#jarClose").addEventListener("click", () =>
  $("#jar-modal").classList.remove("active"),
);

/* ================= CAKE ================= */
let litCount = 0;
$$(".candle").forEach((c) => {
  c.addEventListener("click", () => {
    if (c.classList.contains("lit")) return;
    c.classList.add("lit");
    litCount++;
    if (litCount === 3) {
      setTimeout(() => {
        $("#cakeMsg").classList.add("show");
        launchConfetti();
      }, 400);
    }
  });
});
function launchConfetti() {
  for (let i = 0; i < 50; i++) {
    const c = document.createElement("div");
    c.style.position = "fixed";
    c.style.left = Math.random() * 100 + "vw";
    c.style.top = "-10px";
    c.style.width = "8px";
    c.style.height = "8px";
    c.style.background = ["#D4AF37", "#C393A3", "#E7C8CF", "#7D4E6E"][
      Math.floor(Math.random() * 4)
    ];
    c.style.zIndex = 300;
    c.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    c.style.pointerEvents = "none";
    document.body.appendChild(c);
    const duration = 2200 + Math.random() * 1500;
    c.animate(
      [
        { transform: "translateY(0) rotate(0deg)", opacity: 1 },
        {
          transform: `translateY(${innerHeight + 40}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0.9,
        },
      ],
      { duration: duration, easing: "ease-in" },
    );
    setTimeout(() => c.remove(), duration);
  }
}

/* ================= MUSIC PLAYER ================= */
console.log(document.getElementById("bgMusic"));
const audio = document.getElementById("bgMusic");

if (!audio) {
  console.error("Audio element not found.");
}

const defaultTracks = [
  {
    n: "Jab Tak",
    a: "Armaan Malik",
    src: "music/jabtak.mpeg",
  },
  {
    n: "Sitare",
    a: "King",
    src: "music/sitare.mpeg",
  },
  {
    n: "Perfect",
    a: "Ed Sheeran",
    src: "music/perfect.mpeg",
  },
];
function normalizedTracks(items) {
  return items
    .map((track, index) => ({
      n: String(track.n || track.title || `Track ${index + 1}`),
      a: String(track.a || track.artist || "Our song"),
      src: safeMediaUrl(track.src || track.audio),
    }))
    .filter((track) => track.src);
}
let tracks = normalizedTracks(bloomList("tracks", defaultTracks));
if (!tracks.length) tracks = normalizedTracks(defaultTracks);
let trackIdx = 0;
let isPlaying = false;

function loadTrack(i) {
  if (!audio || !tracks.length) return;

  trackIdx = (i + tracks.length) % tracks.length;

  audio.src = tracks[trackIdx].src;

  $("#trackName").textContent = tracks[trackIdx].n;

  $(".track-artist").textContent = "Our Song · " + tracks[trackIdx].a;
}

function startMusic() {
  loadTrack(trackIdx);

  audio.play().catch(() => {});

  isPlaying = true;

  $("#playPause").textContent = "⏸";
  $("#vinyl").classList.add("spin");
}

function stopMusic() {
  audio.pause();

  isPlaying = false;

  $("#playPause").textContent = "▶";
  $("#vinyl").classList.remove("spin");
}

$("#playPause").addEventListener("click", () => {
  if (isPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
});

$("#nextTrack").addEventListener("click", () => {
  loadTrack(trackIdx + 1);

  audio.play();
});

$("#prevTrack").addEventListener("click", () => {
  loadTrack(trackIdx - 1);

  audio.play();
});

audio.addEventListener("ended", () => {
  loadTrack(trackIdx + 1);

  audio.play();
});

loadTrack(0);

audio.volume = 0.6;

// let audioCtx, isPlaying=false, oscNodes=[];
// function startMusic(){
//   if(isPlaying) return;
//   try{
//     audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
//     playAmbient();
//     isPlaying=true;
//     $('#playPause') && ($('#playPause').textContent='⏸');
//     $('#vinyl') && $('#vinyl').classList.add('spin');
//   }catch(e){}
// }
// function playAmbient(){
//   const notes=[261.63,329.63,392.0];
//   notes.forEach((f,i)=>{
//     const osc=audioCtx.createOscillator();
//     const gain=audioCtx.createGain();
//     osc.type='sine';
//     osc.frequency.value=f;
//     gain.gain.value=0.0001;
//     osc.connect(gain).connect(audioCtx.destination);
//     osc.start();
//     gain.gain.linearRampToValueAtTime(0.015,audioCtx.currentTime+2+i);
//     oscNodes.push({osc,gain});
//   });
// }
// function stopMusic(){
//   oscNodes.forEach(n=>{ try{ n.gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime+0.5); n.osc.stop(audioCtx.currentTime+0.6); }catch(e){} });
//   oscNodes=[];
//   isPlaying=false;
// }
// $('#playPause').addEventListener('click',()=>{
//   if(isPlaying){ stopMusic(); $('#playPause').textContent='▶'; $('#vinyl').classList.remove('spin'); }
//   else { startMusic(); $('#playPause').textContent='⏸'; $('#vinyl').classList.add('spin'); }
// });
// const tracks=[
//   {
//     n:'Jab Tak',
//     a:'Ed Sheeran',
//     src:'music/jabtak.mpeg'
//   },
//   {
//     n:'Sitare',
//     a:'John Legend',
//     src:'music/sitare.mpeg'
//   },
//   {
//     n:'Perfect',
//     a:'Ed Sheeran',
//     src:'music/perfect.mpeg'
//   }
// ];
// let trackIdx=0;
// function setTrack(i){
//   trackIdx=(i+tracks.length)%tracks.length;
//   $('#trackName').textContent=tracks[trackIdx].n;
//   $('.track-artist').textContent='Our Song · '+tracks[trackIdx].a;
// }
// $('#nextTrack').addEventListener('click',()=>setTrack(trackIdx+1));
// $('#prevTrack').addEventListener('click',()=>setTrack(trackIdx-1));

/* ================= ROTATING 3D GALLERY ================= */
const rotRing = $("#rotRing");
let rotAngle = 0;
const defaultRotImages = [
  "images/i1.jpg",
  "images/i2.jpg",
  "images/i3.jpg",
  "images/i4.jpg",
  "images/i5.jpg",
  "images/i6.jpg",
  "images/i7.jpg",
  "images/i8.jpg",
];
function normalizedRotImages(items) {
  return items.map((item) => safeMediaUrl(typeof item === "string" ? item : item.image));
}
let rotImages = normalizedRotImages(bloomList("rotatingPhotos", defaultRotImages));
function renderRotatingGallery() {
  rotRing.replaceChildren();
  const rotCount = rotImages.length;
  rotImages.forEach((img, index) => {
    const card = document.createElement("div");
    card.className = "rot-card";
    card.innerHTML = img ? `<img src="${safeHtml(img)}" alt="Memory ${index + 1}">` : "♡";
    card.style.transform = `rotateY(${(360 / Math.max(rotCount, 1)) * index}deg) translateZ(320px)`;
    rotRing.appendChild(card);
  });
}
renderRotatingGallery();

function applyRot() {
  rotRing.style.transform = `rotateY(${rotAngle}deg)`;
}
let dragging = false,
  startX = 0,
  startAngle = 0;
rotRing.addEventListener("pointerdown", (e) => {
  dragging = true;
  startX = e.clientX;
  startAngle = rotAngle;
  rotRing.style.cursor = "grabbing";
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  rotAngle = startAngle + (e.clientX - startX) * 0.4;
  applyRot();
});
window.addEventListener("pointerup", () => {
  dragging = false;
  rotRing.style.cursor = "grab";
});
let autoRotate = true;
function autoSpin() {
  if (!dragging && autoRotate) {
    rotAngle += 0.15;
    applyRot();
  }
  requestAnimationFrame(autoSpin);
}
autoSpin();

/* =============================
   MOVIE CURTAIN
============================= */

const movieSection = document.querySelector("#movie-night");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document.getElementById("curtainLeft").classList.add("open");

        document.getElementById("curtainRight").classList.add("open");
      }
    });
  },
  {
    threshold: 0.45,
  },
);

observer.observe(movieSection);

/* ================= SCRATCH CARD ================= */

const scratchCanvas = document.getElementById("scratchCanvas");
const scratchCtx = scratchCanvas.getContext("2d");

function resizeScratch() {

    scratchCanvas.width = scratchCanvas.offsetWidth;
    scratchCanvas.height = scratchCanvas.offsetHeight;

    // Gold Foil
    const grad = scratchCtx.createLinearGradient(
        0,
        0,
        scratchCanvas.width,
        scratchCanvas.height
    );

    grad.addColorStop(0, "#e9d48d");
    grad.addColorStop(0.5, "#cfa84d");
    grad.addColorStop(1, "#f5e6a5");

    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.fillStyle = grad;
    scratchCtx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);

    scratchCtx.fillStyle = "rgba(255,255,255,.15)";

    for (let i = 0; i < 600; i++) {

        scratchCtx.beginPath();

        scratchCtx.arc(
            Math.random() * scratchCanvas.width,
            Math.random() * scratchCanvas.height,
            Math.random() * 3,
            0,
            Math.PI * 2
        );

        scratchCtx.fill();
    }

    scratchCtx.fillStyle = "#fff";
    scratchCtx.font = "700 42px 'Cormorant Garamond'";
    scratchCtx.textAlign = "center";

    scratchCtx.fillText(
        bloomValue("scratchCoverLabel", "Scratch Here ✨"),
        scratchCanvas.width / 2,
        scratchCanvas.height / 2
    );
}

resizeScratch();

window.addEventListener("resize", resizeScratch);

let scratching = false;

function scratch(e) {
    if (!scratching) return;

    e.preventDefault();

    const rect = scratchCanvas.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (scratchCanvas.width / rect.width);
    const y = (clientY - rect.top) * (scratchCanvas.height / rect.height);

    scratchCtx.globalCompositeOperation = "destination-out";
    scratchCtx.beginPath();
    scratchCtx.arc(x, y, 35, 0, Math.PI * 2);
    scratchCtx.fill();
}

// Mouse
scratchCanvas.addEventListener("mousedown", () => scratching = true);
window.addEventListener("mouseup", () => scratching = false);
scratchCanvas.addEventListener("mousemove", scratch);

// Touch
scratchCanvas.addEventListener("touchstart", () => scratching = true, { passive: false });
window.addEventListener("touchend", () => scratching = false);
scratchCanvas.addEventListener("touchmove", scratch, { passive: false });

// Pointer (works on many modern browsers)
scratchCanvas.addEventListener("pointerdown", () => scratching = true);
window.addEventListener("pointerup", () => scratching = false);
scratchCanvas.addEventListener("pointermove", scratch);

/*=========================================
            PHOTO PUZZLE
=========================================*/

const puzzleBoard = document.getElementById("puzzleBoard");
const puzzleDone = document.getElementById("puzzleDone");

const size = 3;

let order = [...Array(9).keys()];

order.sort(() => Math.random() - 0.5);

let selected = null;
let puzzleImage = safeMediaUrl(bloomData.puzzleImage || "images/i2.jpg");

function renderPuzzle(){

    puzzleBoard.innerHTML="";

    order.forEach((piece,index)=>{

        const div=document.createElement("div");

        div.className="puzzle-piece";
        div.style.backgroundImage = `url("${safeHtml(puzzleImage)}")`;

        if(selected===index)
            div.classList.add("selected");

        const col=piece%size;
        const row=Math.floor(piece/size);

        div.style.backgroundPosition=

            `${col*50}% ${row*50}%`;

        div.onclick=()=>clickPiece(index);

        puzzleBoard.appendChild(div);

    });

}

function clickPiece(index){

    if(selected===null){

        selected=index;

        renderPuzzle();

        return;

    }

    [order[selected],order[index]]=[

        order[index],

        order[selected]

    ];

    selected=null;

    renderPuzzle();

    checkSolved();

}

function checkSolved(){

    const solved=order.every((v,i)=>v===i);

    if(solved){

        puzzleDone.classList.add("show");

        launchConfetti();

    }

}

renderPuzzle();

/* ================= COUNTDOWN ================= */
function nextAnniversary() {
  const now = new Date();
  const relationshipDate = new Date(`${bloomValue("relationshipDate", "2025-06-25")}T00:00:00`);
  const month = Number.isNaN(relationshipDate.getTime()) ? 5 : relationshipDate.getMonth();
  const day = Number.isNaN(relationshipDate.getTime()) ? 25 : relationshipDate.getDate();
  let year = now.getFullYear();
  let target = new Date(year, month, day);
  if (now >= target) target = new Date(year + 1, 5, 25);
  return target;
}
function updateCountdown() {
  const target = nextAnniversary();
  const now = new Date();
  let diff = target - now;
  if (diff < 0) diff = 0;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  $("#cdDays").textContent = String(d).padStart(2, "0");
  $("#cdHours").textContent = String(h).padStart(2, "0");
  $("#cdMins").textContent = String(m).padStart(2, "0");
  $("#cdSecs").textContent = String(s).padStart(2, "0");
}
setInterval(updateCountdown, 1000);
updateCountdown();

/* ================= SECRET LOCK ================= */
const VALID_NAMES = ["love", "my love", "beautiful"]; // generic fallback so it always works pleasantly
$("#slBtn").addEventListener("click", unlockSecret);
$("#slInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") unlockSecret();
});
function unlockSecret() {
  const val = $("#slInput").value.trim();
  if (val.length > 0) {
    $("#slError").classList.remove("show");
    $("#future-plans").classList.add("show");
    document.body.style.setProperty("--gold-glow", "1");
    $("#secretlock").style.transition = "background 1.2s ease";
    $("#secretlock").style.background =
      "radial-gradient(ellipse at center, #3a1c2c, #1a0a14)";
    setTimeout(
      () =>
        $("#future-plans").scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      400,
    );
  } else {
    $("#slError").classList.add("show");
  }
}
/* ================= REPLAY ================= */
$("#replayBtn").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => location.reload(), 700);
});

/* welcome visible class needed for reveal transition after bloom */

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.data?.type !== "devsphere-bloom-template-update") return;
  setBloomWatermarkRemoved(event.data.removeWatermark === true);
  bloomData = event.data.data && typeof event.data.data === "object" ? event.data.data : {};
  CODE = bloomValue("passcodeCode", "250626");
  entered = "";
  updateDots();

  timelineData = normalizedTimeline(bloomList("timeline", defaultTimelineData));
  renderTimelineCards();
  galleryData = normalizedGallery(bloomList("photos", defaultGalleryData));
  renderGallery();
  lettersData = normalizedLetters(bloomList("letters", defaultLettersData));
  renderLetters();
  jarReasons = normalizedReasons(bloomList("reasons", defaultJarReasons));
  jarLeft = Math.max(0, jarReasons.length - jarDiscoveries);
  $("#jarCount").textContent = jarLeft;
  tracks = normalizedTracks(bloomList("tracks", defaultTracks));
  if (!tracks.length) tracks = normalizedTracks(defaultTracks);
  trackIdx = 0;
  loadTrack(0);
  rotImages = normalizedRotImages(bloomList("rotatingPhotos", defaultRotImages));
  renderRotatingGallery();
  puzzleImage = safeMediaUrl(bloomData.puzzleImage || "images/i2.jpg");
  order = [...Array(9).keys()].sort(() => Math.random() - 0.5);
  selected = null;
  renderPuzzle();
  applyBloomText();
  resizeScratch();
  updateCountdown();
});
