import { useState, useRef, useCallback, type RefObject } from 'react';

interface SwipeAction {
  label: string;
  icon?: string;
  color?: 'red' | 'green' | 'blue' | 'yellow';
  onAction: () => void;
}

interface UseSwipeActionOptions {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  enabled?: boolean;
}

interface UseSwipeActionReturn<T extends HTMLElement> {
  ref: RefObject<T>;
  swipeOffset: number;
  swiping: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function useSwipeAction<T extends HTMLElement = HTMLDivElement>(
  options: UseSwipeActionOptions,
): UseSwipeActionReturn<T> {
  const { leftAction, rightAction, threshold = 80, enabled = true } = options;
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipingRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const ref = useRef<T>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      swipingRef.current = true;
      setSwiping(true);
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipingRef.current) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - startX.current;
      const deltaY = currentY - startY.current;

      // If vertical scroll is dominant, don't swipe
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      // Prevent horizontal scroll
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }

      // Limit swipe based on available actions
      let offset = deltaX;
      if (deltaX > 0 && !rightAction) offset = 0;
      if (deltaX < 0 && !leftAction) offset = 0;

      setSwipeOffset(offset);
    },
    [enabled, leftAction, rightAction],
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;

    if (swipeOffset > threshold && rightAction) {
      rightAction.onAction();
    } else if (swipeOffset < -threshold && leftAction) {
      leftAction.onAction();
    }

    swipingRef.current = false;
    setSwipeOffset(0);
    setSwiping(false);
  }, [enabled, swipeOffset, threshold, leftAction, rightAction]);

  return {
    ref,
    swipeOffset,
    swiping,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

/** Swipeable list item wrapper component. */
export function SwipeableItem({
  children,
  leftAction,
  rightAction,
  swipeOffset,
  threshold = 80,
}: {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  swipeOffset: number;
  threshold?: number;
}) {
  const progress = Math.min(1, Math.abs(swipeOffset) / threshold);

  const actionColorClasses = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Left action background */}
      {leftAction && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center px-4 ${actionColorClasses[leftAction.color || 'red']}`}
          style={{ width: `${Math.abs(swipeOffset)}px`, opacity: progress }}
        >
          <span className="text-white text-sm font-medium whitespace-nowrap">
            {leftAction.icon && <span className="mr-1">{leftAction.icon}</span>}
            {leftAction.label}
          </span>
        </div>
      )}

      {/* Right action background */}
      {rightAction && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center px-4 ${actionColorClasses[rightAction.color || 'green']}`}
          style={{ width: `${Math.abs(swipeOffset)}px`, opacity: progress }}
        >
          <span className="text-white text-sm font-medium whitespace-nowrap">
            {rightAction.label}
            {rightAction.icon && <span className="ml-1">{rightAction.icon}</span>}
          </span>
        </div>
      )}

      {/* Content */}
      <div
        className="relative bg-white dark:bg-gray-800 transition-transform"
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
