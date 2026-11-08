# craig-neeson-personal-new

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

## Deployment
Pushing to `main` runs the [Build and deploy](.github/workflows/deploy.yml) GitHub Actions workflow, which lints, builds into `dist/` and publishes it to GitHub Pages at https://craigneeson.co.uk. Pull requests run the lint and build steps only.
