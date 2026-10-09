import { parseState, type AdministrativeState } from "./state-schema";
const DB_NAME = "mindlin-ai-demo";
const PDF_STORE = "pdf-files";
const STATE_STORE = "administrative-state";
const DB_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "Cerrá las pestañas anteriores de Mindlin AI para actualizar el almacenamiento.",
        ),
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onupgradeneeded = () => {
      for (const store of [PDF_STORE, STATE_STORE])
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store);
    };
  });
}
export async function getPdfBlob(key: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE);
      const request = tx.objectStore(PDF_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// The callback is synchronous: no await may escape the active IndexedDB transaction.
export async function transactState(
  initialize: () => AdministrativeState,
  operation?: (
    state: AdministrativeState,
    pdfs: IDBObjectStore,
  ) => AdministrativeState,
): Promise<AdministrativeState> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STATE_STORE, PDF_STORE], "readwrite");
      const store = tx.objectStore(STATE_STORE);
      const request = store.get("current");
      let result: AdministrativeState;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const current = request.result
            ? parseState(request.result)
            : parseState(initialize());
          result = operation
            ? parseState({
                ...operation(current, tx.objectStore(PDF_STORE)),
                revision: current.revision + 1,
              })
            : current;
          store.put(result, "current");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(
          failure ||
            tx.error ||
            new Error(
              "No se pudieron guardar los datos locales. No se confirmó la operación.",
            ),
        );
    });
  } finally {
    db.close();
  }
}

export async function readRawAdministrativeState(): Promise<unknown> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE);
      const request = tx.objectStore(STATE_STORE).get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
