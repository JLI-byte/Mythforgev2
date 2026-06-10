"use client";

import { useState, useRef, useEffect } from 'react';
import { DeskWidgetType } from '@/store/workspaceStore';
import { PALETTE_ITEMS } from './deskConstants';
import styles from '../WritingDesk.module.css';

// WIDGET LIBRARY DROPDOWN
// ============================================================

export function WidgetLibraryDropdown({ onSelect }: { onSelect: (type: DeskWidgetType) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.modeDropdownContainer} ref={dropdownRef}>
      <button 
        className={`${styles.spineControlBtn} ${isOpen ? styles.spineControlBtnActive : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title="Artifact Library"
      >
        ➕
      </button>

      {isOpen && (
        <div className={styles.modeDropdownContent} style={{ width: '200px' }}>
          <div className={styles.modeDropdownHeader}>Widget Library</div>
          <div className={styles.modeDropdownScroll} style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {PALETTE_ITEMS.filter(item => item.type !== 'writingZone').map(item => (
              <button 
                key={item.type} 
                className={styles.modeOption}
                onClick={() => { onSelect(item.type); setIsOpen(false); }}
              >
                <span className={styles.modeOptionIcon}>{item.icon}</span>
                <span className={styles.modeOptionLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
