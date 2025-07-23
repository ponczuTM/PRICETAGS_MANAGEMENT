import React from 'react';
import styles from './Navbar.module.css';
import { Link } from 'react-router-dom';

const Navbar = ({ logoText = 'ZARZĄDZANIE PRICETAGAMI'}) => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <span className={styles.logoText}>{logoText}</span>
      </div>
      <div className={styles.navbarLinks}>
        <Link to="/" className={styles.navLink}>Urządzenia</Link>
        <Link to="/groups" className={styles.navLink}>Grupy</Link>
        <Link to="/schedule" className={styles.navLink}>Harmonogram</Link>
      </div>
    </nav>
  );
};

export default Navbar;
