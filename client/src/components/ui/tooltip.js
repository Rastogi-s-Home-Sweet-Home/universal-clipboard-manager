import React from 'react';

export const Tooltip = ({ content, children }) => {
    return (
        <div className="relative inline-block">
            {children}
            <div className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded p-1">
                {content}
            </div>
        </div>
    );
};