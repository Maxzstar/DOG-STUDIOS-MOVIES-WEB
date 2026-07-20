# DOG Studios Movies Web

A cinematic, mobile-friendly home for DOG Studios films. The site is a static project made for GitHub Pages—no build step or paid server is required.

## Publish it on GitHub

The link ending in `/issues` is for reporting bugs. Upload these files in the repository's main **Code** area:

1. Open [Maxzstar/DOG-STUDIOS-MOVIES-WEB](https://github.com/Maxzstar/DOG-STUDIOS-MOVIES-WEB).
2. Choose **Add file → Upload files**.
3. Upload everything in this folder, including `assets`, `index.html`, `styles.css`, `films.js`, and `app.js`.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select `main`, choose `/ (root)`, and press **Save**.

GitHub will show the public Pages address after deployment finishes.

## Add a public movie

Send the movie file to Codex and ask for it to be added. The public website intentionally has no visitor upload button.

To publish a movie for every visitor:

1. Put the poster in `assets/posters/`.
2. Put a small web-ready `.mp4` or `.webm` in `assets/movies/`, or use a direct hosted video URL.
3. Open `films.js` and copy the example movie object into `window.DOG_FILMS = [ ... ];`.
4. Commit the changes on GitHub. Pages will update automatically.

Example:

```js
window.DOG_FILMS = [
  {
    id: "my-first-movie",
    title: "My First Movie",
    year: "2026",
    runtime: "14 min",
    genre: "Drama",
    status: "published",
    logline: "A short description of the movie.",
    poster: "assets/posters/my-first-movie.jpg",
    videoUrl: "assets/movies/my-first-movie.mp4"
  }
];
```

Use `status: "soon"` for a coming-soon film.

## Important video note

GitHub's web upload is limited to 25 MiB per file. Git from a computer can push files up to 100 MiB; larger files require Git LFS. GitHub Pages is not intended to be a large video-streaming host, so full-length or high-resolution movies should live with a streaming/video provider. Put the video's direct playback URL in `videoUrl`. Posters and small trailers can live in this repository.

## Customize

- Studio text and contact email: `index.html`
- Colors and layout: `styles.css`
- Public films: `films.js`
- Main cinematic image: `assets/cinematic-motel-hero.png`

The sample films disappear automatically as soon as at least one public film is added to `films.js`.
