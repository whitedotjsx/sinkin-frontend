## Deployment

If you wish to deploy the project for production, you can pack the project by `npm run build` and serve the static files at `build/`

Since it's a static SPA, you need to route all requests to index.html, or the application routes won't work correctly.

TLDR:

1. Pack the project
```bash
npm run build
```

2. Serve **SPA static files** from `/build`
## Documentation

The project is built with the static adapter of SvelteKit and works
as a SPA
## Authors

- [@whitesu](https://www.github.com/whitedotjsx)

