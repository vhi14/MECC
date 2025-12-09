import React from 'react';
import styles from './NavItem.css';

function NavItem({ icon, label, multiline }) {
  return (
    <div className={styles.navItem}>
      <img src={icon} alt="" className={styles.navIcon} />
      <div className={multiline ? styles.multilineLabel : styles.label}>{label}</div>
    </div>
  );
}

export default NavItem;

