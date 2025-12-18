'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorToast {
    id: string;
    message: string;
    timestamp: Date;
}

interface ErrorToastContextType {
    showError: (key: string, defaultMessage?: string) => void;
    clearError: (id: string) => void;
    clearAll: () => void;
}

interface ErrorMessageSetting {
    key: string;
    title: string;
    message: string;
    banner_enabled?: boolean;
}

const ErrorToastContext = createContext<ErrorToastContextType | null>(null);

export function useErrorToast() {
    const context = useContext(ErrorToastContext);
    if (!context) {
        throw new Error('useErrorToast must be used within ErrorToastProvider');
    }
    return context;
}

export function ErrorToastProvider({ children }: { children: ReactNode }) {
    const [errors, setErrors] = useState<ErrorToast[]>([]);
    const [messages, setMessages] = useState<Record<string, ErrorMessageSetting>>({});

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await fetch('/api/error-messages');
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data);
                }
            } catch (error) {
                console.error('Failed to fetch error messages:', error);
            }
        };
        fetchMessages();
    }, []);

    const showError = useCallback((key: string, defaultMessage?: string) => {
        const setting = messages[key];

        // バナー表示設定が無効な場合は何もしない（設定がない場合はデフォルト表示）
        if (setting && setting.banner_enabled === false) {
            return;
        }

        const message = setting ? setting.message : (defaultMessage || 'エラーが発生しました');
        const id = Math.random().toString(36).substring(7);

        setErrors((prev) => [...prev, { id, message, timestamp: new Date() }]);
    }, [messages]);

    const clearError = useCallback((id: string) => {
        setErrors((prev) => prev.filter((error) => error.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setErrors([]);
    }, []);

    return (
        <ErrorToastContext.Provider value={{ showError, clearError, clearAll }}>
            {children}
            <div className="fixed bottom-4 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4">
                {errors.map((error) => (
                    <div
                        key={error.id}
                        className="animate-slide-down pointer-events-auto bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium flex-grow whitespace-pre-wrap">{error.message}</p>
                        <button
                            onClick={() => clearError(error.id)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ErrorToastContext.Provider>
    );
}
