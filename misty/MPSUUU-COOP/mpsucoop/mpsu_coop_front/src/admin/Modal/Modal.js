import React from 'react';
import styles from './Modal.css'; 

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeButton} onClick={onClose}>Close</button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
