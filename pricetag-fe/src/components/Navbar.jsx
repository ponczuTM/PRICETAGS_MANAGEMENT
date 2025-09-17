import React, { useState } from 'react'; // ZMIANA: Import useState
import styles from './Navbar.module.css';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ logoText = 'ZARZĄDZANIE PRICETAGAMI' }) => {
  const navigate = useNavigate();
  // ZMIANA: Dodajemy stan do obsługi otwarcia/zamknięcia menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsMenuOpen(false); // Zamknij menu po wylogowaniu
    navigate("/");
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarBrand}>
        <span className={styles.logoText}>{logoText}</span>
      </div>

      {/* ZMIANA: Ikona hamburgera */}
      <div 
        className={`${styles.menuIcon} ${isMenuOpen ? styles.open : ''}`} 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* ZMIANA: Dodajemy warunkową klasę .active */}
      <div className={`${styles.navbarLinks} ${isMenuOpen ? styles.active : ''}`}>
        <Link to="/mainpage" className={styles.navLink} onClick={closeMenu}>Urządzenia</Link>
        <Link to="/groups" className={styles.navLink} onClick={closeMenu}>Grupy</Link>
        <Link to="/schedule" className={styles.navLink} onClick={closeMenu}>Harmonogram</Link>
        <Link to="/gallery" className={styles.navLink} onClick={closeMenu}>Galeria plików</Link>
        <Link to="/settings" className={styles.navLink} onClick={closeMenu}>Ustawienia</Link>
        <button onClick={handleLogout} className={styles.logoutButton}>Wyloguj się</button>
      </div>
    </nav>
  );
};

export default Navbar;