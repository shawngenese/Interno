import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ActionsMenuProps {
  items: ActionMenuItem[];
  align?: 'right' | 'left';
}

export function ActionsMenu({ items, align = 'right' }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = items.length * 40 + 8;

    let top = rect.bottom + 4;
    let left = align === 'right' ? rect.right - menuWidth : rect.left;

    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 4;
    }
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [align, items.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };

    const handleScroll = () => {
      if (open) updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, close, updatePosition]);

  const handleItemClick = (item: ActionMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    close();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-[#9E9E9E] hover:text-[#555555] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[160px] bg-white dark:bg-[#1E1E1E] border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
          role="menu"
        >
          {items.map((item, i) =>
            item.disabled ? null : (
              <button
                key={i}
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50'
                }`}
                role="menuitem"
              >
                {item.icon && <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </>
  );
}
