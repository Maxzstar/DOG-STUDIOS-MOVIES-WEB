const sampleFilms = [
  {
    id: "demo-last-light",
    title: "The Last Light",
    year: "2026",
    runtime: "18 min",
    genre: "Drama",
    status: "published",
    logline: "At the edge of the map, one quiet night changes everything.",
    posterClass: "poster-blue",
    demo: true,
    heroImage: "assets/cinematic-motel-hero.png",
  },
  {
    id: "demo-quiet-hours",
    title: "Quiet Hours",
    year: "2026",
    runtime: "12 min",
    genre: "Thriller",
    status: "soon",
    logline: "A night clerk begins to notice a pattern in the guests who never check out.",
    posterClass: "poster-red",
    demo: true,
  },
  {
    id: "demo-after-sun",
    title: "After the Sun",
    year: "2025",
    runtime: "24 min",
    genre: "Adventure",
    status: "published",
    logline: "Two old friends chase the last warm day of the year across an empty coast.",
    posterClass: "poster-amber",
    demo: true,
  },
  {
    id: "demo-green-room",
    title: "The Green Room",
    year: "2025",
    runtime: "9 min",
    genre: "Mystery",
    status: "published",
    logline: "Minutes before opening night, an actor finds a note meant for someone else.",
    posterClass: "poster-green",
    demo: true,
  },
  {
    id: "demo-slow-orbit",
    title: "Slow Orbit",
    year: "2027",
    runtime: "In production",
    genre: "Drama",
    status: "soon",
    logline: "A story about distance, memory, and finding a way back home.",
    posterClass: "poster-violet",
    demo: true,
  },
];

const configuredFilms = Array.isArray(window.DOG_FILMS)
  ? window.DOG_FILMS.map((film, index) => ({
      ...film,
      id: film.id || `public-film-${index + 1}`,
      demo: true,
    }))
  : [];

const demoFilms = configuredFilms.length ? configuredFilms : sampleFilms;
const LIKE_STORAGE_KEY = "dog-studios-liked-films-v1";
const QUEST_STORAGE_KEY = "dog-studios-quests-v1";
const QUESTS = [
  {
    id: "opening-night",
    symbol: "▶",
    title: "Opening Night",
    description: "Start watching your first DOG Studios movie.",
    metric: "startedFilms",
    target: 1,
    xp: 50,
  },
  {
    id: "favorite-find",
    symbol: "♥",
    title: "Favorite Find",
    description: "Like a film and add it to your personal favorites.",
    metric: "likedFilms",
    target: 1,
    xp: 75,
  },
  {
    id: "credits-roller",
    symbol: "★",
    title: "Credits Roller",
    description: "Finish one movie or watch at least 80% of it.",
    metric: "watchedFilms",
    target: 1,
    xp: 100,
  },
  {
    id: "triple-feature",
    symbol: "III",
    title: "Triple Feature",
    description: "Finish three different movies from the studio library.",
    metric: "watchedFilms",
    target: 3,
    xp: 250,
  },
  {
    id: "studio-explorer",
    symbol: "⌕",
    title: "Studio Explorer",
    description: "Open the details for three different films.",
    metric: "exploredFilms",
    target: 3,
    xp: 75,
  },
  {
    id: "marathon-mode",
    symbol: "∞",
    title: "Marathon Mode",
    description: "Spend fifteen minutes watching DOG Studios movies.",
    metric: "watchSeconds",
    target: 15 * 60,
    xp: 150,
  },
];
const QUEST_RANKS = [
  { name: "New Viewer", xp: 0 },
  { name: "Cinema Scout", xp: 100 },
  { name: "Film Hunter", xp: 250 },
  { name: "Studio Insider", xp: 450 },
  { name: "DOG Studios Legend", xp: 700 },
];

let films = [];
let activeFilter = "all";
let searchTerm = "";
let currentFilm = null;
let likedFilmIds = new Set();
let questState = createDefaultQuestState();
let questLastMediaTime = 0;
let questLastSaveBucket = 0;
let completedQuestIds = new Set();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const filmGrid = $("#filmGrid");
const emptyState = $("#emptyState");
const filmDialog = $("#filmDialog");
const playerDialog = $("#playerDialog");
const moviePlayer = $("#moviePlayer");
const playerShell = $("#playerShell");
const playerStart = $("#playerStart");
const playerStartLabel = $("#playerStartLabel");
const playerStartHint = $("#playerStartHint");
const dialogLike = $("#dialogLike");
const dialogLikeLabel = $("#dialogLikeLabel");
const questGrid = $("#questGrid");
const questToast = $("#questToast");
const questToastTitle = $("#questToastTitle");

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadLikedFilms() {
  try {
    const storedLikes = JSON.parse(localStorage.getItem(LIKE_STORAGE_KEY) || "[]");
    likedFilmIds = new Set(Array.isArray(storedLikes) ? storedLikes.filter((id) => typeof id === "string") : []);
  } catch (error) {
    likedFilmIds = new Set();
  }
}

function saveLikedFilms() {
  try {
    localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify([...likedFilmIds]));
  } catch (error) {
    // The like still works for this visit if browser storage is unavailable.
  }
}

function createDefaultQuestState() {
  return {
    startedFilms: [],
    likedFilms: [],
    watchedFilms: [],
    exploredFilms: [],
    watchSeconds: 0,
  };
}

function normalizeQuestFilmIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === "string"))] : [];
}

function loadQuestState() {
  const fallback = createDefaultQuestState();
  try {
    const stored = JSON.parse(localStorage.getItem(QUEST_STORAGE_KEY) || "null") || fallback;
    questState = {
      startedFilms: normalizeQuestFilmIds(stored.startedFilms),
      likedFilms: normalizeQuestFilmIds(stored.likedFilms),
      watchedFilms: normalizeQuestFilmIds(stored.watchedFilms),
      exploredFilms: normalizeQuestFilmIds(stored.exploredFilms),
      watchSeconds: Number.isFinite(Number(stored.watchSeconds)) ? Math.max(0, Number(stored.watchSeconds)) : 0,
    };
  } catch (error) {
    questState = fallback;
  }

  let likesAdded = false;
  likedFilmIds.forEach((filmId) => {
    if (!questState.likedFilms.includes(filmId)) {
      questState.likedFilms.push(filmId);
      likesAdded = true;
    }
  });
  questLastSaveBucket = Math.floor(questState.watchSeconds / 5);
  if (likesAdded) saveQuestState();
}

function saveQuestState() {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(questState));
  } catch (error) {
    // Quest progress remains available for this visit if storage is blocked.
  }
}

function getQuestValue(quest) {
  if (quest.metric === "watchSeconds") return questState.watchSeconds;
  return questState[quest.metric].length;
}

function getCompletedQuestXp() {
  return QUESTS.reduce((total, quest) => total + (getQuestValue(quest) >= quest.target ? quest.xp : 0), 0);
}

function getQuestRank(xp) {
  let rankIndex = 0;
  QUEST_RANKS.forEach((rank, index) => {
    if (xp >= rank.xp) rankIndex = index;
  });

  const current = QUEST_RANKS[rankIndex];
  const next = QUEST_RANKS[rankIndex + 1] || null;
  const progress = next ? ((xp - current.xp) / (next.xp - current.xp)) * 100 : 100;
  return {
    current,
    next,
    progress: Math.max(0, Math.min(100, progress)),
  };
}

function getQuestProgressText(quest, value) {
  if (quest.metric === "watchSeconds") {
    const currentMinutes = Math.min(quest.target, value) / 60;
    const shownMinutes = currentMinutes < 1 ? currentMinutes.toFixed(1) : Math.floor(currentMinutes);
    return `${shownMinutes} / ${quest.target / 60} min`;
  }
  return `${Math.min(value, quest.target)} / ${quest.target}`;
}

function showQuestUnlock(quests) {
  const firstQuest = quests[0];
  if (!firstQuest) return;
  questToastTitle.textContent = quests.length > 1 ? `${firstQuest.title} + ${quests.length - 1} more` : firstQuest.title;
  questToast.classList.remove("show");
  void questToast.offsetWidth;
  questToast.classList.add("show");
  clearTimeout(showQuestUnlock.timeout);
  showQuestUnlock.timeout = setTimeout(() => questToast.classList.remove("show"), 4200);
}

function renderQuests(announceUnlocks = false) {
  const completedNow = new Set();

  questGrid.innerHTML = QUESTS.map((quest, index) => {
    const value = getQuestValue(quest);
    const completed = value >= quest.target;
    if (completed) completedNow.add(quest.id);
    const percent = Math.max(0, Math.min(100, (value / quest.target) * 100));
    const progressText = getQuestProgressText(quest, value);

    return `
      <article class="quest-card${completed ? " is-complete" : ""}">
        <div class="quest-card-top">
          <span class="quest-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="quest-reward">+${quest.xp} XP</span>
        </div>
        <span class="quest-symbol" aria-hidden="true">${escapeHTML(quest.symbol)}</span>
        <div class="quest-copy">
          <p>${completed ? "Quest complete" : "Viewer quest"}</p>
          <h3>${escapeHTML(quest.title)}</h3>
          <span>${escapeHTML(quest.description)}</span>
        </div>
        <div class="quest-progress">
          <div><strong>${progressText}</strong><span>${completed ? "Complete" : "In progress"}</span></div>
          <div class="quest-progress-track" role="progressbar" aria-label="${escapeHTML(quest.title)} progress" aria-valuemin="0" aria-valuemax="${quest.target}" aria-valuenow="${Math.min(value, quest.target)}">
            <i style="width:${percent}%"></i>
          </div>
        </div>
      </article>
    `;
  }).join("");

  const xp = getCompletedQuestXp();
  const rank = getQuestRank(xp);
  $("#questXp").textContent = xp;
  $("#questRank").textContent = rank.current.name;
  $("#questXpBar").style.width = `${rank.progress}%`;
  $("#questNextRank").textContent = rank.next ? `${rank.next.xp - xp} XP to ${rank.next.name}` : "Highest rank reached";

  if (announceUnlocks) {
    const newUnlocks = QUESTS.filter((quest) => completedNow.has(quest.id) && !completedQuestIds.has(quest.id));
    showQuestUnlock(newUnlocks);
  }
  completedQuestIds = completedNow;
}

function recordQuestFilm(collection, filmId) {
  if (!filmId || questState[collection].includes(filmId)) return false;
  questState[collection].push(filmId);
  saveQuestState();
  renderQuests(true);
  return true;
}

function trackQuestWatchTime() {
  const currentTime = Number(moviePlayer.currentTime) || 0;
  const delta = currentTime - questLastMediaTime;
  questLastMediaTime = currentTime;
  if (moviePlayer.paused || delta <= 0 || delta > 3) return;

  questState.watchSeconds += delta;
  let completedFilm = false;
  if (
    currentFilm &&
    Number.isFinite(moviePlayer.duration) &&
    moviePlayer.duration > 0 &&
    currentTime / moviePlayer.duration >= 0.8 &&
    !questState.watchedFilms.includes(currentFilm.id)
  ) {
    questState.watchedFilms.push(currentFilm.id);
    completedFilm = true;
  }

  const saveBucket = Math.floor(questState.watchSeconds / 5);
  if (completedFilm || saveBucket !== questLastSaveBucket) {
    questLastSaveBucket = saveBucket;
    saveQuestState();
    renderQuests(true);
  }
}

function flushQuestProgress() {
  questLastMediaTime = Number(moviePlayer.currentTime) || 0;
  saveQuestState();
  renderQuests(true);
}

function isFilmLiked(filmId) {
  return likedFilmIds.has(filmId);
}

function updateLikeButton() {
  if (!currentFilm) return;
  const liked = isFilmLiked(currentFilm.id);
  dialogLike.classList.toggle("is-liked", liked);
  dialogLike.setAttribute("aria-pressed", String(liked));
  dialogLike.setAttribute("aria-label", liked ? `Remove like from ${currentFilm.title}` : `Like ${currentFilm.title}`);
  dialogLikeLabel.textContent = liked ? "Liked" : "Like film";
}

function toggleCurrentFilmLike() {
  if (!currentFilm) return;
  if (isFilmLiked(currentFilm.id)) likedFilmIds.delete(currentFilm.id);
  else {
    likedFilmIds.add(currentFilm.id);
    recordQuestFilm("likedFilms", currentFilm.id);
  }
  saveLikedFilms();
  updateLikeButton();
  renderFilms();
}

async function loadFilms() {
  films = [...demoFilms];
  renderFilms();
  updateFeatured(films[0]);
}

function getPosterUrl(film) {
  return film.poster || null;
}

function posterStyle(film) {
  const posterUrl = getPosterUrl(film);
  return posterUrl ? ` style="background-image:url('${posterUrl}')"` : "";
}

function posterClass(film) {
  if (film.posterClass) return film.posterClass;
  const classes = ["poster-blue", "poster-red", "poster-amber", "poster-green", "poster-violet"];
  const score = [...film.title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return classes[score % classes.length];
}

function renderFilms() {
  const filtered = films.filter((film) => {
    const matchesFilter = activeFilter === "all" || film.status === activeFilter;
    const haystack = `${film.title} ${film.genre} ${film.year}`.toLowerCase();
    return matchesFilter && haystack.includes(searchTerm);
  });

  filmGrid.innerHTML = filtered
    .map(
      (film) => `
        <button class="film-card reveal visible" type="button" data-film-id="${escapeHTML(film.id)}" aria-label="View ${escapeHTML(film.title)}">
          <div class="film-poster">
            <div class="film-poster-art ${posterClass(film)}"${posterStyle(film)}>
              <span class="film-badge">${film.status === "soon" ? "Coming soon" : film.videoUrl ? "Watch now" : "DOG Original"}</span>
              ${isFilmLiked(film.id) ? '<span class="film-liked-badge" aria-hidden="true">♥</span>' : ""}
              <div class="poster-title">
                ${escapeHTML(film.title)}
                <small>A DOG Studios film</small>
              </div>
            </div>
          </div>
          <div class="film-card-body">
            <div>
              <h3>${escapeHTML(film.title)}</h3>
              <p>${escapeHTML(film.year)} &nbsp;·&nbsp; ${escapeHTML(film.genre || "Film")}</p>
            </div>
            <span class="card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
            </span>
          </div>
        </button>
      `,
    )
    .join("");

  emptyState.hidden = filtered.length !== 0;
  filmGrid.hidden = filtered.length === 0;
}

function splitHeroTitle(title) {
  const words = title.trim().split(/\s+/);
  if (words.length === 1) return escapeHTML(title);
  const last = words.pop();
  return `${escapeHTML(words.join(" "))}<br><i>${escapeHTML(last)}</i>`;
}

function updateFeatured(film) {
  if (!film) return;
  const heroBackdrop = $("#heroBackdrop");
  const heroTitle = $("#heroTitle");
  const displayTitle = film.heroTitle || film.title;
  const imageUrl = getPosterUrl(film) || film.heroImage || "assets/cinematic-motel-hero.png";
  heroBackdrop.style.backgroundImage = `url('${imageUrl}')`;
  heroTitle.classList.toggle("long-title", displayTitle.length > 18);
  heroTitle.innerHTML = splitHeroTitle(displayTitle);
  $("#heroLogline").textContent = film.logline;
  $("#heroYear").textContent = film.year || "—";
  $("#heroRuntime").textContent = film.runtime || "—";
  $("#heroGenre").textContent = film.genre || "Film";
  $("#watchFeatured").dataset.filmId = film.id;
  $("#featuredDetails").dataset.filmId = film.id;
}

function findFilm(id) {
  return films.find((film) => film.id === id);
}

function openFilmDetails(film) {
  if (!film) return;
  currentFilm = film;
  recordQuestFilm("exploredFilms", film.id);
  $("#dialogTitle").textContent = film.title;
  $("#dialogLogline").textContent = film.logline;
  $("#dialogMeta").innerHTML = [film.year, film.runtime, film.genre, film.status === "soon" ? "Coming soon" : "Released"]
    .filter(Boolean)
    .map((item) => `<span>${escapeHTML(item)}</span>`)
    .join("");

  const dialogPoster = $("#dialogPoster");
  dialogPoster.className = `dialog-poster ${posterClass(film)}`;
  const imageUrl = getPosterUrl(film);
  dialogPoster.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : "";

  const watchButton = $("#dialogWatch");
  watchButton.innerHTML = `<span class="play-icon" aria-hidden="true"></span> ${film.status === "soon" ? "Preview" : "Watch film"}`;
  updateLikeButton();
  filmDialog.showModal();
  document.body.classList.add("dialog-open");
}

function closeFilmDetails() {
  if (filmDialog.open) filmDialog.close();
  document.body.classList.remove("dialog-open");
}

async function playFilm(film) {
  if (!film) return;
  if (filmDialog.open) filmDialog.close();
  currentFilm = film;
  $("#playerTitle").textContent = film.title;
  playerShell.className = "player-shell";

  if (film.videoUrl) {
    const filmPoster = getPosterUrl(film);
    if (filmPoster) moviePlayer.poster = filmPoster;
    else moviePlayer.removeAttribute("poster");
    moviePlayer.src = film.videoUrl;
    moviePlayer.load();
    playerStartLabel.textContent = "Play movie";
    playerStartHint.textContent = film.runtime || "Press to start";
    playerShell.classList.add("has-video", "needs-play");
  } else {
    moviePlayer.removeAttribute("src");
    moviePlayer.removeAttribute("poster");
    moviePlayer.load();
  }

  playerDialog.showModal();
  document.body.classList.add("dialog-open");
}

async function startPlayback() {
  if (!moviePlayer.src) return;
  if (playerShell.classList.contains("is-loading")) return;
  playerShell.classList.remove("needs-play", "has-error", "is-playing");
  playerShell.classList.add("is-loading");
  playerStartLabel.textContent = "Starting…";
  playerStartHint.textContent = "Preparing the movie";

  try {
    await moviePlayer.play();
  } catch (error) {
    playerShell.classList.remove("is-loading", "is-playing");
    playerShell.classList.add("has-error");
    playerStartLabel.textContent = "Try again";
    playerStartHint.textContent = "Your browser paused playback";
  }
}

function closePlayer() {
  flushQuestProgress();
  moviePlayer.pause();
  moviePlayer.removeAttribute("src");
  moviePlayer.removeAttribute("poster");
  moviePlayer.load();
  playerShell.className = "player-shell";
  questLastMediaTime = 0;
  if (playerDialog.open) playerDialog.close();
  document.body.classList.remove("dialog-open");
}

function closeMobileMenu() {
  $("#menuButton").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  $("#mobileNav").classList.remove("open");
}

function setupEvents() {
  filmGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-film-id]");
    if (card) openFilmDetails(findFilm(card.dataset.filmId));
  });

  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeFilter = button.dataset.filter;
      renderFilms();
    });
  });

  $("#filmSearch").addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderFilms();
  });

  $("#closeFilmDialog").addEventListener("click", closeFilmDetails);
  $("#dialogWatch").addEventListener("click", () => playFilm(currentFilm));
  dialogLike.addEventListener("click", toggleCurrentFilmLike);
  $("#closePlayer").addEventListener("click", closePlayer);
  playerStart.addEventListener("click", startPlayback);

  moviePlayer.addEventListener("playing", () => {
    playerShell.classList.remove("needs-play", "is-loading", "has-error");
    playerShell.classList.add("is-playing");
    questLastMediaTime = Number(moviePlayer.currentTime) || 0;
    if (currentFilm) recordQuestFilm("startedFilms", currentFilm.id);
  });

  moviePlayer.addEventListener("timeupdate", trackQuestWatchTime);
  moviePlayer.addEventListener("seeking", () => {
    questLastMediaTime = Number(moviePlayer.currentTime) || 0;
  });
  moviePlayer.addEventListener("pause", flushQuestProgress);

  moviePlayer.addEventListener("waiting", () => {
    if (moviePlayer.paused || moviePlayer.currentTime === 0) return;
    playerShell.classList.remove("is-playing");
    playerShell.classList.add("is-loading");
    playerStartLabel.textContent = "Buffering…";
    playerStartHint.textContent = "Playback will resume automatically";
  });

  moviePlayer.addEventListener("ended", () => {
    if (currentFilm) recordQuestFilm("watchedFilms", currentFilm.id);
    playerShell.classList.remove("is-playing", "is-loading");
    playerShell.classList.add("needs-play");
    playerStartLabel.textContent = "Watch again";
    playerStartHint.textContent = currentFilm?.runtime || "Replay movie";
  });

  moviePlayer.addEventListener("error", () => {
    if (!moviePlayer.src) return;
    playerShell.classList.remove("is-playing", "is-loading");
    playerShell.classList.add("has-error");
    playerStartLabel.textContent = "Try again";
    playerStartHint.textContent = "The movie could not start";
  });

  $("#watchFeatured").addEventListener("click", (event) => playFilm(findFilm(event.currentTarget.dataset.filmId)));
  $("#featuredDetails").addEventListener("click", (event) => openFilmDetails(findFilm(event.currentTarget.dataset.filmId)));

  filmDialog.addEventListener("click", (event) => {
    if (event.target === filmDialog) {
      filmDialog.close();
      document.body.classList.remove("dialog-open");
    }
  });

  playerDialog.addEventListener("click", (event) => {
    if (event.target === playerDialog) closePlayer();
  });

  $("#menuButton").addEventListener("click", () => {
    const button = $("#menuButton");
    const isOpen = button.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
    $("#mobileNav").classList.toggle("open", isOpen);
  });

  $$("#mobileNav a").forEach((link) => link.addEventListener("click", closeMobileMenu));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (playerDialog.open) closePlayer();
    else if (filmDialog.open) closeFilmDetails();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveQuestState();
  });
  window.addEventListener("beforeunload", saveQuestState);
}

function setupReveals() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  $$(".reveal").forEach((element) => observer.observe(element));
}

async function init() {
  $("#copyrightYear").textContent = new Date().getFullYear();
  loadLikedFilms();
  loadQuestState();
  setupEvents();
  setupReveals();
  await loadFilms();
  renderQuests(false);
}

init();
