export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClipboardHistoryDB', 1);

    request.onerror = (event) => {
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('clipboardHistory', { keyPath: 'id', autoIncrement: true });
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