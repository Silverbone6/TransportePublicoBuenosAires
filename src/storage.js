let database;
async function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('trama-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export async function loadProject() {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('projects').objectStore('projects').get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function saveProject(project) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project, 'current');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
