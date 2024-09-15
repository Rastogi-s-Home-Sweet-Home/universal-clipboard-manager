import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { XMarkIcon } from '@heroicons/react/24/solid';

function ClipboardHistory({ isOpen, onClose, onCopy }) {
  const [history, setHistory] = useState([]);

  const openDatabase = useCallback(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ClipboardManagerDB', 1);

      request.onerror = (event) => reject('Error opening database');

      request.onsuccess = (event) => resolve(event.target.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('clipboardHistory', { keyPath: 'id', autoIncrement: true });
      };
    });
  }, []);

  const loadHistory = useCallback(async () => {
    if (isOpen) {
      const db = await openDatabase();
      const transaction = db.transaction(['clipboardHistory'], 'readonly');
      const objectStore = transaction.objectStore('clipboardHistory');
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const result = event.target.result;
        setHistory(result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100));
      };
    }
  }, [isOpen, openDatabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const clearHistory = async () => {
    const db = await openDatabase();
    const transaction = db.transaction(['clipboardHistory'], 'readwrite');
    const objectStore = transaction.objectStore('clipboardHistory');
    const request = objectStore.clear();

    request.onsuccess = () => {
      setHistory([]);
    };

    request.onerror = (event) => {
      console.error('Error clearing history:', event.target.error);
    };
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'sent':
        return '↑';
      case 'received':
        return '↓';
      case 'copied':
        return '✓';
      default:
        return '-';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Clipboard History</h2>
          {history.length > 0 && (
            <Button onClick={clearHistory} variant="destructive" size="sm">
              Clear History
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Your clipboard history is empty.</p>
            <p>Copy or send some content to see it here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                <span className="mr-2">{getTypeIcon(item.type)}</span>
                <span className="truncate flex-grow mr-2">{item.content}</span>
                <Button onClick={() => onCopy(item.content)} size="sm">Copy</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipboardHistory;