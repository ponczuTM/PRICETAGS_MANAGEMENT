import React from 'react';
import styles from './Navbar.module.css';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ logoText = 'ZARZĄDZANIE PRICETAGAMI' }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/"); // przenosi na stronę logowania
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <span className={styles.logoText}>{logoText}</span>
      </div>
      <div className={styles.navbarLinks}>
        <Link to="/mainpage" className={styles.navLink}>Urządzenia</Link>
        <Link to="/groups" className={styles.navLink}>Grupy</Link>
        <Link to="/schedule" className={styles.navLink}>Harmonogram</Link>
        <Link to="/gallery" className={styles.navLink}>Galeria plików</Link>
        <button onClick={handleLogout} className={styles.logoutButton}>Wyloguj się</button>
      </div>
    </nav>
  );
};

export default Navbar;
