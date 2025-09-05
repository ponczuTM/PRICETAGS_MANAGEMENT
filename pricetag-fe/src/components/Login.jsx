import React, { useState } from "react";
import styles from "./Login.module.css";
import logo from "../assets/images/logo.png";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setUserInfo(null);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/priceusers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          otp: otpRequired ? otp.trim() : undefined, // ⬅️ wyślij tylko gdy potrzebny
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Gdy backend mówi, że potrzeba OTP – pokaż pole i nie traktuj jako „błąd końcowy”
        if (data?.detail === "OTP_REQUIRED") {
          setOtpRequired(true);
          setErrorMsg("Wpisz jednorazowy kod z aplikacji.");
          return;
        }
        throw new Error(data.detail || data.message || "Logowanie nieudane");
      }

      const { user, token } = data;

      if (!user.locationIds || !Array.isArray(user.locationIds) || user.locationIds.length === 0) {
        throw new Error("Użytkownik nie ma przypisanych lokalizacji.");
      }

      localStorage.setItem("token", token || "");
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("locationIds", JSON.stringify(user.locationIds));
      localStorage.setItem("locationId", user.locationIds[0]);

      setUserInfo(user);
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
            onChange={(e)=>setEmail(e.target.value)}
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
            onChange={(e)=>setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {otpRequired && (
          <div className={styles.formRow}>
            <label htmlFor="otp">Kod z aplikacji:</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={otp}
              onChange={(e)=>setOtp(e.target.value)}
              placeholder="123456"
            />
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Logowanie..." : (otpRequired ? "Potwierdź kod" : "Zaloguj")}
        </button>

        <p className={styles.registerNote}>
          Nie posiadasz konta? <Link to="/register">Zarejestruj się</Link>
        </p>

        {errorMsg && <p className={styles.errorMessage}>{errorMsg}</p>}
      </form>

      {userInfo && (
        <div className={styles.userInfo}>
          <h3>Zalogowano pomyślnie!</h3>
          <p><strong>Użytkownik:</strong> {userInfo.first_name} {userInfo.last_name}</p>
          <p><strong>Email:</strong> {userInfo.email}</p>
          <p><strong>Location IDs:</strong> {Array.isArray(userInfo.locationIds) ? userInfo.locationIds.join(", ") : "—"}</p>
          <p className={styles.redirectMessage}>Za chwilę nastąpi przekierowanie…</p>
        </div>
      )}
    </div>
  );
};

export default Login;
