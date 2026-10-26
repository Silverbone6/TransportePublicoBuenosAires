import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectApi } from './project-api.js';

export function repositoryPersistence() {
  const directory = process.env.TRAMA_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url));
  const middleware = projectApi(directory);
  return {
    name: 'trama-repository-persistence',
    configureServer(server) {
      // Saved data is not source code: saving must not reload the editor.
      server.watcher.unwatch(path.resolve(directory));
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
