export interface SyncQueueItem<TPayload = Record<string, unknown>> {
  id: string;
  eventId: string;
  eventType: string;
  payload: TPayload;
  createdAt: number;
  retryCount: number;
  lastError: string | null;
  syncState: "pending" | "failed" | "syncing";
}

export interface AppMetaRecord<TValue = unknown> {
  key: string;
  value: TValue;
  updatedAt: number;
}

const DB_NAME = "one-detailer-pwa";
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = "syncQueue";
const APP_META_STORE = "appMeta";

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase() {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
        syncStore.createIndex("eventId", "eventId", { unique: true });
        syncStore.createIndex("syncState", "syncState", { unique: false });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(APP_META_STORE)) {
        database.createObjectStore(APP_META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

export async function upsertSyncQueueItem<TPayload>(item: SyncQueueItem<TPayload>) {
  const database = await openDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, "readwrite");
  const store = transaction.objectStore(SYNC_QUEUE_STORE);
  store.put(item);
  return transactionToPromise(transaction).catch(() => undefined);
}

export async function getSyncQueueItems<TPayload = Record<string, unknown>>() {
  const database = await openDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, "readonly");
  const store = transaction.objectStore(SYNC_QUEUE_STORE);
  const items = await requestToPromise(store.getAll() as IDBRequest<SyncQueueItem<TPayload>[]>);
  return items.sort((left, right) => left.createdAt - right.createdAt);
}

export async function deleteSyncQueueItems(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const database = await openDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, "readwrite");
  const store = transaction.objectStore(SYNC_QUEUE_STORE);
  ids.forEach((id) => store.delete(id));
  return transactionToPromise(transaction).catch(() => undefined);
}

export async function getSyncQueueSize() {
  const items = await getSyncQueueItems();
  return items.length;
}

export async function setAppMeta<TValue>(key: string, value: TValue) {
  const database = await openDatabase();
  const transaction = database.transaction(APP_META_STORE, "readwrite");
  const store = transaction.objectStore(APP_META_STORE);
  store.put({
    key,
    value,
    updatedAt: Date.now(),
  } satisfies AppMetaRecord<TValue>);
  return transactionToPromise(transaction).catch(() => undefined);
}

export async function getAppMeta<TValue = unknown>(key: string) {
  const database = await openDatabase();
  const transaction = database.transaction(APP_META_STORE, "readonly");
  const store = transaction.objectStore(APP_META_STORE);
  const record = await requestToPromise(store.get(key) as IDBRequest<AppMetaRecord<TValue> | undefined>);
  return record || null;
}

export async function clearSyncQueue() {
  const database = await openDatabase();
  const transaction = database.transaction(SYNC_QUEUE_STORE, "readwrite");
  const store = transaction.objectStore(SYNC_QUEUE_STORE);
  store.clear();
  return transactionToPromise(transaction).catch(() => undefined);
}
