import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toastMessages, setToastMessages] = useState([]);

  const showToast = ({ title, description, action, duration = 3000 }) => {
    const id = Date.now();
    const newToastMessage = { id, title, description, action };
    
    setToastMessages((prev) => [...prev, newToastMessage]);
    
    if (duration !== null) {
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((msg) => msg.id !== id));
      }, duration);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toastMessages.map((message) => (
          <div
            key={message.id}
            className="bg-white rounded-lg shadow-lg p-4 min-w-[300px] flex flex-col gap-2"
          >
            {message.title && (
              <div className="font-semibold">{message.title}</div>
            )}
            {message.description && (
              <div className="text-gray-600">{message.description}</div>
            )}
            {message.action && (
              <div className="mt-2">{message.action}</div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.showToast;
};