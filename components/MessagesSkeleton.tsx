import React from 'react';

export const MessagesSkeleton = () => {
    return (
        <div className="flex flex-col h-full bg-white animate-pulse">
            {/* Header Skeleton */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="w-24 h-10 bg-gray-200 rounded-lg"></div>
            </div>

            {/* Messages Area Skeleton */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} gap-2`}>
                        {i % 2 !== 0 && <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0"></div>}
                        <div className={`max-w-[70%] p-4 rounded-2xl ${i % 2 === 0 ? 'bg-admin-primary/10' : 'bg-white border border-gray-200'}`}>
                            <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                            {i === 2 && <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>}
                            <div className="h-2 bg-gray-100 rounded w-12 ml-auto"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area Skeleton */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                </div>
            </div>
        </div>
    );
};

export const ConversationsSkeleton = () => {
    return (
        <div className="w-full bg-white divide-y divide-gray-200 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 flex gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-2">
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-3 bg-gray-100 rounded w-8"></div>
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};
