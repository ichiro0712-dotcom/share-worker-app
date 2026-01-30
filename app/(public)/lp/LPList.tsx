'use client';

import { useState } from 'react';

type LPPage = {
  id: string;
  path: string;
  title: string;
};

export default function LPList({ initialPages }: { initialPages: LPPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (page: LPPage) => {
    setEditingId(page.id);
    setEditValue(page.title);
  };

  const saveEdit = async (id: string) => {
    try {
      await fetch('/api/lp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editValue }),
      });

      setPages(pages.map(p =>
        p.id === id ? { ...p, title: editValue } : p
      ));
      setEditingId(null);
    } catch (e) {
      alert('保存に失敗しました');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      {pages.map((page) => (
        <div
          key={page.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #e8e8e8',
            background: '#fafafa',
          }}
        >
          <span style={{
            fontSize: '12px',
            color: '#666',
            background: '#e8e8e8',
            padding: '2px 8px',
            borderRadius: '3px',
            minWidth: '32px',
            textAlign: 'center',
          }}>
            {page.id}
          </span>

          {editingId === page.id ? (
            <>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(page.id);
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => saveEdit(page.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                保存
              </button>
              <button
                onClick={cancelEdit}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  background: '#999',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </>
          ) : (
            <>
              <span
                onClick={() => startEdit(page)}
                style={{
                  flex: 1,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                title="クリックして編集"
              >
                {page.title}
              </span>
              <a
                href={page.path}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: '#0066cc',
                  textDecoration: 'none',
                }}
              >
                開く →
              </a>
            </>
          )}
        </div>
      ))}

      {pages.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#666',
        }}>
          LPページが見つかりません
        </div>
      )}
    </div>
  );
}
