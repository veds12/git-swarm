# GitSwarm: Decentralized Compounding Inference

Project page for the paper *GitSwarm: Decentralized Compounding Inference* ([arXiv:2610.04862](https://arxiv.org/abs/2610.04862)).

The site is a single self-contained `index.html` (figure data, scripts and fonts are inlined), so it can be served
by GitHub Pages as-is.

## Publish on GitHub Pages

1. Create a new repository on GitHub (for example `gitswarm`).
2. Push this folder to it:

   ```bash
   cd gitswarm-website
   git init
   git add .
   git commit -m "GitSwarm project page"
   git branch -M main
   git remote add origin https://github.com/<your-username>/gitswarm.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose branch `main` and folder
   `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/gitswarm/`.

`.nojekyll` tells GitHub Pages to serve the files directly instead of running them through Jekyll.

## Editing

The page is built from `source/`:

- `source/template.html`: page structure, text and styles
- `source/app.js`: the swarm animation, interactive figures and charts
- `source/data/*.json`: figure data extracted from the paper

After editing, rebuild `index.html` with:

```bash
python3 source/build.py
```
