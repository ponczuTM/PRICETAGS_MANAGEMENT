import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./Register.module.css";
import logo from "../assets/images/logo.png";

const Register = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [locationName, setLocationName] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPwd, setShowPwd]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirm) {
      setErrorMsg("Hasła nie są identyczne.");
      return;
    }
    if (!firstName || !lastName || !email || !password || !locationName) {
      setErrorMsg("Uzupełnij wszystkie wymagane pola.");
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password: password,
      locationName: locationName.trim(),
      // ❌ bez locationIds — admin nada później
    };

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/priceusers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.message || "Rejestracja nieudana");
      }

      // ✅ sukces – przenosimy do logowania
      navigate("/");
    } catch (err) {
      setErrorMsg(err.message || "Rejestracja nieudana.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registerContainer}>
      <img src={logo} alt="Logo" className={styles.logo} />
      <h2>Rejestracja</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <label htmlFor="firstName">Imię*</label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jan"
            required
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="lastName">Nazwisko*</label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Kowalski"
            required
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="email">Email*</label>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jan.kowalski@example.com"
            required
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="password">Hasło*</label>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className={styles.pwdToggle}
              onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? "Ukryj hasło" : "Pokaż hasło"}
              title={showPwd ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPwd ? "Ukryj" : "Pokaż"}
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <label htmlFor="confirm">Powtórz hasło*</label>
          <input
            id="confirm"
            type={showPwd ? "text" : "password"}
            value={confirm}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="locationName">Nazwa lokalizacji*</label>
          <input
            id="locationName"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Toronto"
            required
          />
        </div>

        <p className={styles.smallNote}>
            Po zalogowaniu możesz włączyć 2FA (Google Authenticator) – w aplikacji przejdź do sekcji „Ustawienia → Bezpieczeństwo”.
        </p>


        <button type="submit" disabled={loading}>
          {loading ? "Rejestruję..." : "Zarejestruj"}
        </button>

        {errorMsg && <p className={styles.errorMessage}>{errorMsg}</p>}

        <p className={styles.smallNote}>
          Masz już konto? <Link to="/login">Zaloguj się</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
