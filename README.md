# Lei Wang — academic homepage

Source for `https://leiongeometry.github.io/`.

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

Pushing to `main` automatically builds the Vite site and deploys `dist/` to GitHub Pages through `.github/workflows/deploy.yml`.

The complete Chinese migration and deployment guide is one directory above this project in `DEPLOYMENT_GUIDE_zh.md`.
