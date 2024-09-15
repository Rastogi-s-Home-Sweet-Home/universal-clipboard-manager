import React from 'react';

function WebSocketStatus({ status }) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-red-500';
      case 'error':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className={`font-semibold ${getStatusColor()}`}>
      WebSocket Status: {status}
    </div>
  );
}

export default WebSocketStatus;