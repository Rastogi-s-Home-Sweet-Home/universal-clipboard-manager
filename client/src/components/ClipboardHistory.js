import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Tooltip } from './ui/tooltip'; // Assuming you have a Tooltip component
import { openDatabase, clearHistory } from '../utils/dbUtils'; // Import openDatabase from dbUtils

function ClipboardHistory({ isOpen, onClose, onCopy, receivedReceipts }) { // Accept receivedReceipts as a prop
  const [history, setHistory] = useState([]);

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
  }, [isOpen]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

  const onClearHistory = async () => {
    await clearHistory();
    setHistory([]);
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
            <Button onClick={onClearHistory} variant="destructive" size="sm">
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
                {item.type === 'received' && Array.isArray(receivedReceipts[item.contentId]) && receivedReceipts[item.contentId].length > 0 && ( // Check if receipts is an array
                  <Tooltip content={receivedReceipts[item.contentId].join(', ')}>
                    <span className="cursor-pointer text-blue-500">ℹ️</span>
                  </Tooltip>
                )}
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