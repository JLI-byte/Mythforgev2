import React, { useEffect, useRef } from 'react';
import styles from './ResizeDivider.module.css';

interface ResizeDividerProps {
  onResize: (deltaX: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

export const ResizeDivider: React.FC<ResizeDividerProps> = ({ 
  onResize, 
  onResizeStart, 
  onResizeEnd, 
  onDoubleClick,
  className 
}) => {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    if (onResizeStart) onResizeStart();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(deltaX);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (onResizeEnd) onResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  return (
    <div
      className={`${styles.divider} ${className || ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.handle} />
    </div>
  );
};
