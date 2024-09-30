import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, CheckIcon } from '@heroicons/react/24/solid';

export const getTypeIcon = (type) => {
  switch (type) {
    case 'sent':
      return <ArrowUpIcon className="h-5 w-5 text-blue-500" />;
    case 'received':
      return <ArrowDownIcon className="h-5 w-5 text-green-500" />;
    case 'copied':
      return <CheckIcon className="h-5 w-5 text-gray-500" />;
    default:
      return <span>-</span>;
  }
};