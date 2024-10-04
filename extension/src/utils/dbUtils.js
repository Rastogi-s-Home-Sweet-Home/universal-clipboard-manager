export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClipboardHistoryDB', 1);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      // The result is an instance of IDBDatabase
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      // The result is an instance of IDBDatabase
      const db = event.target.result;
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains('clipboardHistory')) {
        db.createObjectStore('clipboardHistory', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const clearHistory = async () => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['clipboardHistory'], 'readwrite');
    const objectStore = transaction.objectStore('clipboardHistory');
    const request = objectStore.clear();

    request.onerror = (event) => {
      reject('Error clearing history');
    };

    request.onsuccess = (event) => {
      resolve();
    };
  });
};

export const saveToHistory = async (item) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['clipboardHistory'], 'readwrite');
    const objectStore = transaction.objectStore('clipboardHistory');
    const request = objectStore.add(item);

    request.onerror = (event) => {
      reject('Error saving to history');
    };

    request.onsuccess = (event) => {
      resolve();
    };
  });
};