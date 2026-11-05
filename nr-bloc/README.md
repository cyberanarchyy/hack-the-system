# The NR Bloc website

Source for https://www.thenrbloc.com: plain HTML and CSS, no build step.

- `index.html` (Home), `events.html` (What's on), `donate.html` (Support the Bloc)
- `styles.css`: all styling
- `logo.png`, `hero.jpg`, `favicon.png`, `apple-touch-icon.png`: images

## Preview locally

    python3 -m http.server 8000

Then open http://localhost:8000

## Deploying

Any static host works (Cloudflare Pages, Netlify, GitHub Pages). Set this
folder (`nr-bloc`) as the site's root or output directory. There is no build
command.
