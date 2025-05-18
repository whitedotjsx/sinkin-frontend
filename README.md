## Deployment

If you wish to deploy the project for production, you can pack the project by `npm run build` and serve the static files at `build/`

Either you should set all the requests to index.html because it is a static SPA or the routes will not behave as expected

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

