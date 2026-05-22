'use client';

import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onCollapse?: () => void;
  onDoubleClick?: () => void;
  label?: string;
}

const COLLAPSE_KEYS = new Set(['Enter', ' ']);
const KEYBOARD_DELTAS: Record<ResizeHandleProps['direction'], Record<string, number>> = {
  horizontal: { ArrowLeft: -16, ArrowRight: 16 },
  vertical: { ArrowUp: -16, ArrowDown: 16 },
};

export function ResizeHandle({ direction, onResize, onCollapse, onDoubleClick, label = '面板' }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startPos = useRef(0);
  const movedDuringDrag = useRef(false);
  const suppressNextClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setDragging(true);
      movedDuringDrag.current = false;
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    },
    [direction],
  );

  const handleClick = useCallback(() => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (!onCollapse) return;
    clickTimer.current = setTimeout(() => {
      onCollapse();
      clickTimer.current = null;
    }, 180);
  }, [onCollapse]);

  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onDoubleClick?.();
  }, [onDoubleClick]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (COLLAPSE_KEYS.has(e.key) && onCollapse) {
        e.preventDefault();
        onCollapse();
        return;
      }

      const delta = KEYBOARD_DELTAS[direction][e.key];
      if (delta !== undefined) {
        e.preventDefault();
        onResize(delta);
      }
    },
    [direction, onCollapse, onResize],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      if (delta !== 0) {
        movedDuringDrag.current = true;
        onResize(delta);
        startPos.current = currentPos;
      }
    };

    const handleMouseUp = () => {
      suppressNextClick.current = movedDuringDrag.current;
      setDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, direction, onResize]);

  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  const isH = direction === 'horizontal';
  const orientation = isH ? 'vertical' : 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={`${label}分隔条`}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={`flex-shrink-0 group relative ${
        isH
          ? 'w-1 cursor-col-resize hover:bg-[var(--console-hover-bg)] active:bg-[var(--console-active-bg)]'
          : 'h-1 cursor-row-resize hover:bg-[var(--console-hover-bg)] active:bg-[var(--console-active-bg)]'
      } ${dragging ? 'bg-[var(--console-active-bg)]' : ''} transition-colors`}
    >
      <div
        className={`absolute ${
          isH
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-8 rounded-full'
        } bg-[var(--console-border-soft)] group-hover:bg-cafe-accent/60 transition-colors ${dragging ? 'bg-cafe-accent/60' : ''}`}
      />
    </div>
  );
}
