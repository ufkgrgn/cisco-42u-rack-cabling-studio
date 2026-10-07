(function () {
  'use strict';
  const RS = window.RackStudio;
  const STORES = ['projects', 'log', 'revisions', 'evidence', 'leases', 'meta', 'recovery'];
  function open() {
    return new Promise((resolve, reject) => {
      let rejected = false;
      const request = indexedDB.open('rack-studio', 2);
      request.onupgradeneeded = () => {
        for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error || new Error('Yerel depo açılamadı.'));
      request.onblocked = () => { rejected = true; reject(new Error('Eski bir sekme veritabanını açık tutuyor. O sekmeyi kapatıp yeniden deneyin.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (rejected) { db.close(); return; }
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }
  // All work inside a transaction is synchronous request scheduling. No await can close it early.
  function transaction(db, stores, mode, work) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result, failure;
      const fail = error => { failure = error; try { tx.abort(); } catch (_) {} };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure || tx.error || new Error('Yerel kayıt başarısız.'));
      tx.onabort = () => reject(failure || tx.error || new Error('Yerel kayıt iptal edildi.'));
      try { work(tx, value => { result = value; }, fail); }
      catch (error) { fail(error); }
    });
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
  RS.ProjectStorageIDB = Object.freeze({ open, transaction, read, entries, STORES });
})();
