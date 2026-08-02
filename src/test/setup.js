import '@testing-library/jest-dom/vitest';

if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [];
  }

  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
    });
  }
}

if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => (
    document.querySelector('[contenteditable="true"]') || document.body
  );
}
