# Lei Wang — academic homepage

Source for `https://leiongeometry.github.io/`.

## Upload to GitHub

Extract this archive and copy the contents of the `leiongeometry.github.io`
folder into the root of the existing GitHub repository. Keep the repository's
`.git` directory, then run:

```bash
npm ci
npm run build
git add -A
git commit -m "Update homepage"
git push origin main
```

The workflow in `.github/workflows/deploy.yml` builds the Vite site and deploys
`dist/` to GitHub Pages after every push to `main`.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm ci
npm run build
```

The production build is generated in `dist/`. That folder is intentionally not
included in the source archive.
