
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  overlayClassName?: string;
  contentClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, overlayClassName, contentClassName }) => {
  if (!isOpen) return null;

  const overlayClasses = [
    'fixed inset-0 z-50 flex items-center justify-center bg-black/80',
    overlayClassName ?? '',
  ].join(' ').trim();

  const contentClasses = [
    'relative w-full max-w-lg p-6 bg-card border border-border rounded-lg shadow-lg',
    contentClassName ?? '',
  ].join(' ').trim();

  return (
    <div
      className={overlayClasses}
      onClick={onClose}
    >
      <div
        className={contentClasses}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
