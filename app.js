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

const DB_NAME = "dog-studios-library";
const STORE_NAME = "films";
const DB_VERSION = 1;

let db;
let films = [];
let activeFilter = "all";
let searchTerm = "";
let currentFilm = null;
let playerUrl = null;
const posterUrls = new Map();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const filmGrid = $("#filmGrid");
const emptyState = $("#emptyState");
const filmDialog = $("#filmDialog");
const playerDialog = $("#playerDialog");
const uploadDialog = $("#uploadDialog");
const uploadForm = $("#uploadForm");
const moviePlayer = $("#moviePlayer");
const playerShell = $("#playerShell");

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readUserFilms() {
  if (!db) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveUserFilm(film) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(film);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function removeUserFilm(id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadFilms() {
  let userFilms = [];
  try {
    userFilms = await readUserFilms();
  } catch (error) {
    console.warn("Could not read the local film library.", error);
  }
  userFilms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  films = [...userFilms, ...demoFilms];
  renderFilms();
  updateFeatured(films[0]);
}

function getPosterUrl(film) {
  if (film.poster) return film.poster;
  if (!film.posterBlob) return null;
  if (!posterUrls.has(film.id)) {
    posterUrls.set(film.id, URL.createObjectURL(film.posterBlob));
  }
  return posterUrls.get(film.id);
}

function posterStyle(film) {
  const posterUrl = getPosterUrl(film);
  return posterUrl ? ` style="background-image:url('${posterUrl}')"` : "";
}

function posterClass(film) {
  if (film.posterBlob) return "poster-custom";
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
              <span class="film-badge">${film.status === "soon" ? "Coming soon" : film.videoBlob || film.videoUrl ? "Watch now" : "DOG Original"}</span>
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
  const imageUrl = getPosterUrl(film) || film.heroImage || "assets/cinematic-motel-hero.png";
  heroBackdrop.style.backgroundImage = `url('${imageUrl}')`;
  $("#heroTitle").innerHTML = splitHeroTitle(film.title);
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

  $("#dialogDelete").hidden = Boolean(film.demo);
  const watchButton = $("#dialogWatch");
  watchButton.innerHTML = `<span class="play-icon" aria-hidden="true"></span> ${film.status === "soon" ? "Preview" : "Watch film"}`;
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
  playerShell.classList.remove("has-video");

  if (film.videoBlob || film.videoUrl) {
    if (playerUrl) URL.revokeObjectURL(playerUrl);
    playerUrl = film.videoBlob ? URL.createObjectURL(film.videoBlob) : null;
    moviePlayer.src = playerUrl || film.videoUrl;
    playerShell.classList.add("has-video");
  } else {
    moviePlayer.removeAttribute("src");
    moviePlayer.load();
  }

  playerDialog.showModal();
  document.body.classList.add("dialog-open");
  if (film.videoBlob || film.videoUrl) {
    try {
      await moviePlayer.play();
    } catch (error) {
      // Browsers may require the viewer to press play themselves.
    }
  }
}

function closePlayer() {
  moviePlayer.pause();
  moviePlayer.removeAttribute("src");
  moviePlayer.load();
  if (playerUrl) URL.revokeObjectURL(playerUrl);
  playerUrl = null;
  playerShell.classList.remove("has-video");
  if (playerDialog.open) playerDialog.close();
  document.body.classList.remove("dialog-open");
}

function openUpload() {
  closeMobileMenu();
  uploadDialog.showModal();
  document.body.classList.add("dialog-open");
  setTimeout(() => uploadForm.elements.title.focus(), 100);
}

function closeUpload() {
  if (uploadDialog.open) uploadDialog.close();
  document.body.classList.remove("dialog-open");
}

function formatFileName(file) {
  if (!file) return null;
  if (file.size < 1024 * 1024) return `${file.name} · ${Math.ceil(file.size / 1024)} KB`;
  return `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function hasStorageSpace(requiredBytes) {
  if (!navigator.storage?.estimate) return true;
  const { quota = Infinity, usage = 0 } = await navigator.storage.estimate();
  return usage + requiredBytes < quota * 0.92;
}

async function handleUpload(event) {
  event.preventDefault();
  if (!db) {
    showToast("Local storage is unavailable in this browser");
    return;
  }

  const data = new FormData(uploadForm);
  const posterFile = data.get("poster");
  const videoFile = data.get("video");
  const posterBlob = posterFile?.size ? posterFile : null;
  const videoBlob = videoFile?.size ? videoFile : null;

  if (posterBlob && posterBlob.size > 20 * 1024 * 1024) {
    showToast("Please use a poster smaller than 20 MB");
    return;
  }

  const totalBytes = (posterBlob?.size || 0) + (videoBlob?.size || 0);
  if (!(await hasStorageSpace(totalBytes))) {
    showToast("This video is too large for your browser storage");
    return;
  }

  const saveButton = $("#saveFilm");
  saveButton.classList.add("is-loading");
  saveButton.disabled = true;

  const film = {
    id: `film-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: data.get("title").trim(),
    year: String(data.get("year")).trim(),
    runtime: data.get("runtime").trim() || "Runtime TBA",
    genre: data.get("genre").trim() || "Film",
    status: data.get("status"),
    logline: data.get("logline").trim(),
    posterBlob,
    videoBlob,
    createdAt: Date.now(),
    demo: false,
  };

  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
    await saveUserFilm(film);
    uploadForm.reset();
    uploadForm.elements.year.value = new Date().getFullYear();
    $("#posterFileName").textContent = "Choose image";
    $("#videoFileName").textContent = "Choose video";
    closeUpload();
    await loadFilms();
    showToast(`${film.title} was added to your library`);
    document.querySelector("#films").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error(error);
    showToast("Could not save this film — try a smaller video");
  } finally {
    saveButton.classList.remove("is-loading");
    saveButton.disabled = false;
  }
}

async function deleteCurrentFilm() {
  if (!currentFilm || currentFilm.demo) return;
  const approved = window.confirm(`Delete “${currentFilm.title}” from this device?`);
  if (!approved) return;

  try {
    const deletedTitle = currentFilm.title;
    await removeUserFilm(currentFilm.id);
    const oldUrl = posterUrls.get(currentFilm.id);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    posterUrls.delete(currentFilm.id);
    closeFilmDetails();
    await loadFilms();
    showToast(`${deletedTitle} was deleted`);
  } catch (error) {
    console.error(error);
    showToast("Could not delete this film");
  }
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

  $$("[data-open-upload]").forEach((button) => button.addEventListener("click", openUpload));
  $("#closeUpload").addEventListener("click", closeUpload);
  $("#cancelUpload").addEventListener("click", closeUpload);
  uploadForm.addEventListener("submit", handleUpload);

  uploadForm.elements.poster.addEventListener("change", (event) => {
    $("#posterFileName").textContent = formatFileName(event.target.files[0]) || "Choose image";
  });
  uploadForm.elements.video.addEventListener("change", (event) => {
    $("#videoFileName").textContent = formatFileName(event.target.files[0]) || "Choose video";
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
  $("#dialogDelete").addEventListener("click", deleteCurrentFilm);
  $("#closePlayer").addEventListener("click", closePlayer);

  $("#watchFeatured").addEventListener("click", (event) => playFilm(findFilm(event.currentTarget.dataset.filmId)));
  $("#featuredDetails").addEventListener("click", (event) => openFilmDetails(findFilm(event.currentTarget.dataset.filmId)));

  [filmDialog, uploadDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
        document.body.classList.remove("dialog-open");
      }
    });
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
    else if (uploadDialog.open) closeUpload();
  });
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
  uploadForm.elements.year.value = new Date().getFullYear();
  setupEvents();
  setupReveals();

  try {
    db = await openDatabase();
  } catch (error) {
    console.warn("IndexedDB is unavailable. Demo mode only.", error);
    showToast("Your browser is in demo mode — uploads cannot be saved");
  }

  await loadFilms();
}

window.addEventListener("beforeunload", () => {
  posterUrls.forEach((url) => URL.revokeObjectURL(url));
  if (playerUrl) URL.revokeObjectURL(playerUrl);
});

init();
