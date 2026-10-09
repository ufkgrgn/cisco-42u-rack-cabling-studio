(function () {
  'use strict';
  const RS = window.RackStudio, idb = RS.ProjectStorageIDB;
  const invoke = window.__TAURI__?.core?.invoke;
  if (!window.__TAURI_INTERNALS__) return;
  // Desktop must fail visibly when the native bridge fails, never save to a browser fallback.
  let queue = Promise.resolve();
  const call = (name, args) => invoke ? invoke(name, args) : Promise.reject(new Error('Yerel kayıt köprüsü kullanılamıyor.'));
  function open() {
    return call('repository_snapshot', { stores: [] }).then(() => new Promise((resolve, reject) => {
      const name = 'rack-studio-native-mirror-' + crypto.randomUUID();
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => { for (const store of idb.STORES) request.result.createObjectStore(store); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    }));
  }
  async function decode(row, store) {
    if (store !== 'evidence') return row;
    const value = { ...row.value };
    const bytes = Uint8Array.from(atob(value.data), char => char.charCodeAt(0));
    value.blob = new Blob([bytes], { type: value.mime });
    delete value.data; delete value.mime;
    return { key: row.key, value };
  }
  async function encode(row, store) {
    if (store !== 'evidence') return row;
    const value = { ...row.value }, bytes = new Uint8Array(await value.blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    value.data = btoa(binary); value.mime = value.blob.type;
    delete value.blob;
    return { key: row.key, value };
  }
  function transaction(db, stores, mode, work) {
    const run = queue.catch(() => {}).then(async () => {
      const snapshot = await call('repository_snapshot', { stores });
      const rows = {};
      for (const store of stores) rows[store] = await Promise.all(snapshot.rows[store].map(row => decode(row, store)));
      // IndexedDB is a disposable request/cursor executor, SQLite is the durable authority.
      await idb.transaction(db, stores, 'readwrite', tx => {
        for (const store of stores) {
          const target = tx.objectStore(store); target.clear();
          for (const row of rows[store]) target.put(row.value, row.key);
        }
      });
      const result = await idb.transaction(db, stores, mode, work);
      if (mode === 'readwrite') {
        const updated = {};
        for (const store of stores) updated[store] = await Promise.all((await idb.entries(db, store)).map(row => encode(row, store)));
        try { await call('repository_commit', { expected: snapshot.version, rows: updated }); }
        catch (error) {
          const failure = new Error(String(error));
          if (failure.message.includes('conflict')) failure.name = 'ProjectConflictError';
          throw failure;
        }
      }
      return result;
    });
    queue = run;
    return run;
  }
  function read(db, store, key) {
    return transaction(db, [store], 'readonly', (tx, done) => {
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => done(request.result);
    });
  }
  function entries(db, store) {
    return transaction(db, [store], 'readonly', (tx, done) => {
      const rows = [], request = tx.objectStore(store).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { rows.push({ key: cursor.key, value: cursor.value }); cursor.continue(); }
        else done(rows);
      };
    });
  }
  RS.ProjectStorageIDB = Object.freeze({ open, transaction, read, entries, STORES: idb.STORES, backend: 'sqlite' });
  RS.NativeSecretProvider = Object.freeze({
    // Only configure/remove/status are exposed. Future native transports consume the secret in Rust.
    set: (provider, secret) => call('repository_secret', { provider, action: 'set', secret }),
    remove: provider => call('repository_secret', { provider, action: 'remove', secret: null }),
    status: provider => call('repository_secret', { provider, action: 'status', secret: null })
  });
})();
