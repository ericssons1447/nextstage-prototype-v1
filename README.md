# NextStage Athletics - Prototype V1

A zero-backend Progressive Web App prototype built with plain HTML, CSS, and JavaScript.

## What it does
- Responsive phone, tablet, and desktop layouts
- Installable PWA structure
- Athlete dashboard and Athlete Passport
- Development tracker and local training log
- Goals and progress tracking
- Fictional/demo opportunity discovery and saving
- Coach/scout-facing demo view
- Local data export and reset
- Offline caching after first load

## What it does NOT do
- No real user accounts
- No server/database
- No real messaging
- No payments
- No verified recruiting or opportunity data
- No collection of sensitive personal information

## Run locally
You can inspect the files directly, but service workers require HTTP/HTTPS. For a local server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 from this folder.

## Publish free with GitHub Pages
1. Create a GitHub account if needed.
2. Create a new PUBLIC repository, for example `nextstage-prototype-v1`.
3. Upload all files and folders from this project to the repository root.
4. Open repository Settings -> Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select branch `main` and folder `/ (root)`, then Save.
7. GitHub will provide a public `github.io` URL after deployment completes.

## Updating the prototype
Edit files in GitHub's web editor or locally, commit changes, and GitHub Pages will republish them.

## Important
Prototype listings are fictional/demo content. Replace them only with data you have permission to publish. Do not put passwords, API keys, private addresses, financial data, or sensitive information in public source code.
