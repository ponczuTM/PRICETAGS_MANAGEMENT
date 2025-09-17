import React, { useState } from 'react';
import styles from './Navbar.module.css';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ logoText = 'ZARZĄDZANIE PRICETAGAMI' }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 🆕 Nowy stan dla menu

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const toggleMenu = () => { // 🆕 Nowa funkcja do otwierania/zamykania menu
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <span className={styles.logoText}>{logoText}</span>
      </div>
      
      {/* 🆕 Dodajemy przycisk/ikonę menu dla urządzeń mobilnych */}
      <button className={styles.hamburger} onClick={toggleMenu}>
        <div className={styles.bar}></div>
        <div className={styles.bar}></div>
        <div className={styles.bar}></div>
      </button>

      {/* 🆕 Dynamiczna klasa, która pokaże menu, gdy jest otwarte */}
      <div className={`${styles.navbarLinks} ${isMenuOpen ? styles.open : ''}`}>
        <Link to="/mainpage" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Urządzenia</Link>
        <Link to="/groups" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Grupy</Link>
        <Link to="/schedule" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Harmonogram</Link>
        <Link to="/gallery" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Galeria plików</Link>
        <Link to="/settings" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>Ustawienia</Link>
        <button onClick={handleLogout} className={styles.logoutButton}>Wyloguj się</button>
      </div>
    </nav>
  );
};

export default Navbar;