import React, { useState } from "react";
import styles from "./Login.module.css";
import logo from "../assets/images/logo.png";
import { useNavigate, Link } from "react-router-dom";


const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e) => setEmail(e.target.value);
  const handlePasswordChange = (e) => setPassword(e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setUserInfo(null);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/priceusers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Odczytaj JSON zawsze, by mieć szczegóły błędu z backendu
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Logowanie nieudane");
      }

      // Backend zwraca { message, user, token } (token to placeholder)
      const { user, token } = data;

      // Walidacja locationIds — musi być niepusta tablica
      if (!user.locationIds || !Array.isArray(user.locationIds) || user.locationIds.length === 0) {
        throw new Error("Użytkownik nie ma przypisanych lokalizacji.");
      }

      // Zapis do localStorage:
      // 1) token (placeholder — możesz później podmienić na JWT)
      localStorage.setItem("token", token || "");
      // 2) cały obiekt user
      localStorage.setItem("user", JSON.stringify(user));
      // 3) tablica locationIds
      localStorage.setItem("locationIds", JSON.stringify(user.locationIds));
      // 4) pierwszy (domyślny) locationId — jeśli reszta frontu tego oczekuje
      localStorage.setItem("locationId", user.locationIds[0]);

      setUserInfo(user);

      // Krótkie opóźnienie dla UX, a potem przekierowanie
      setTimeout(() => navigate("/mainpage"), 800);
    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg(error.message || "Wystąpił błąd podczas logowania.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <img src={logo} alt="Logo" className={styles.logo} />
      <h2>Zaloguj się</h2>

      <form onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
            placeholder="jan.kowalski@example.com"
            autoComplete="username"
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="password">Hasło:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Logowanie..." : "Zaloguj"}
        </button>
        
        <p className={styles.registerNote}>
            Nie posiadasz konta? <Link to="/register">Zarejestruj się</Link>
        </p>


        {errorMsg && <p className={styles.errorMessage}>{errorMsg}</p>}
      </form>

      {userInfo && (
        <div className={styles.userInfo}>
          <h3>Zalogowano pomyślnie!</h3>
          <p>
            <strong>Użytkownik:</strong> {userInfo.first_name} {userInfo.last_name}
          </p>
          <p>
            <strong>Email:</strong> {userInfo.email}
          </p>
          <p>
            <strong>Location IDs:</strong>{" "}
            {Array.isArray(userInfo.locationIds) ? userInfo.locationIds.join(", ") : "—"}
          </p>
          <p className={styles.redirectMessage}>Za chwilę nastąpi przekierowanie…</p>
        </div>
      )}
    </div>
  );
};

export default Login;
