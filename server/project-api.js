import { createProjectStore, ProjectStoreError } from './project-store.js';

export function projectApi(directory) {
  const store = createProjectStore(directory);
  return async function handleProject(req, res, next = () => { res.writeHead(404); res.end(); }) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== '/api/project') return next();
    const respond = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    try {
      const host = (req.headers.host || '').toLowerCase();
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) throw new ProjectStoreError('Este servicio de guardado solo admite acceso local.', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`)) throw new ProjectStoreError('La solicitud de guardado debe venir de esta misma app local.', 403);
      if (req.method === 'GET') return respond(200, { ...(await store.read()), storage: 'repository', file: 'data/proyecto.json' });
      if (req.method !== 'PUT') return respond(405, { error: 'Usá GET o PUT para acceder al proyecto.' });
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ProjectStoreError('El proyecto debe enviarse como JSON.', 415);
      let body;
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { throw new ProjectStoreError('No se pudo leer el proyecto enviado.', 400); }
      if (!body || !Object.hasOwn(body, 'baseRevision') || (body.baseRevision !== null && typeof body.baseRevision !== 'string')) throw new ProjectStoreError('Falta la revisión del proyecto que se está editando.', 400);
      const saved = await store.write(body.project, body.baseRevision);
      return respond(200, { revision: saved.revision, storage: 'repository', file: 'data/proyecto.json' });
    } catch (error) {
      return respond(error.status || 500, { error: error.status ? error.message : 'No se pudo acceder al proyecto del repositorio.', ...(error.status === 409 ? { code: 'conflict', revision: error.revision, project: error.project } : {}) });
    }
  };
}
