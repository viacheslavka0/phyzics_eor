import React, { useEffect, useRef, useCallback } from "react";

/**
 * Accessible modal dialog component with WCAG 2.1 compliance.
 *
 * Features:
 * - role="dialog" for screen readers
 * - aria-modal="true" to indicate modal behavior
 * - aria-labelledby for accessible title
 * - Focus trap: keeps focus within modal
 * - Escape key to close
 * - Backdrop click to close (optional)
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {function} props.onClose - Called when modal should close
 * @param {string} props.titleId - ID of the element that labels the modal (aria-labelledby)
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.className - Additional CSS classes
 */
export function AccessibleModal({
  isOpen,
  onClose,
  titleId,
  children,
  className = "",
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle focus trap and keyboard events
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before modal opened
    previousActiveElement.current = document.activeElement;

    // Trap focus within modal
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Tab trap: keep focus within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (e.shiftKey) {
          if (activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Focus first focusable element in modal
    if (modalRef.current) {
      const firstFocusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to element that opened modal
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed inset-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md max-h-[80vh] overflow-auto bg-white rounded-lg shadow-xl z-50 ${className}`}
      >
        {children}
      </div>
    </>
  );
}

export default React.memo(AccessibleModal);
