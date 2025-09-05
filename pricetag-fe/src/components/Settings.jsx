import React, { useEffect, useState } from "react";
import styles from "./Settings.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000/api/priceusers";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [password, setPassword] = useState("");

  // Setup response
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [otpauthUri, setOtpauthUri] = useState(null);

  // Test OTP
  const [otp, setOtp] = useState("");
  const [testResult, setTestResult] = useState("");

  // UX
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/");
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    setTotpEnabled(!!parsed.totp_enabled);
  }, [navigate]);

  async function refreshUser() {
    try {
      if (!user?._id) return;
      setLoadingRefresh(true);
      const res = await fetch(`${API_BASE}/${user._id}`);
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setTotpEnabled(!!data.totp_enabled);
        localStorage.setItem("user", JSON.stringify(data));
      } else {
        throw new Error(data?.detail || "Nie udało się odświeżyć użytkownika.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingRefresh(false);
    }
  }

  async function handleEnable2FA(e) {
    e.preventDefault();
    setErrorMsg("");
    setTestResult("");
    setQrDataUrl(null);
    setSecret(null);
    setOtpauthUri(null);

    if (!user?.email) {
      setErrorMsg("Brak emaila użytkownika w sesji.");
      return;
    }
    if (!password) {
      setErrorMsg("Podaj hasło, aby potwierdzić.");
      return;
    }

    try {
      setLoadingSetup(true);
      const res = await fetch(`${API_BASE}/totp/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Nie udało się włączyć 2FA.");
      }
      // Backend już włączył 2FA i zwrócił QR + secret
      setQrDataUrl(data.qr_data_url);
      setSecret(data.secret);
      setOtpauthUri(data.otpauth_uri);
      await refreshUser();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingSetup(false);
    }
  }

  async function handleDisable2FA() {
    setErrorMsg("");
    setTestResult("");
    setQrDataUrl(null);
    setSecret(null);
    setOtpauthUri(null);

    if (!user?.email) {
      setErrorMsg("Brak emaila użytkownika w sesji.");
      return;
    }
    if (!password) {
      setErrorMsg("Podaj hasło, aby potwierdzić.");
      return;
    }

    try {
      setLoadingDisable(true);
      const res = await fetch(`${API_BASE}/totp/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Nie udało się wyłączyć 2FA.");
      }
      await refreshUser();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingDisable(false);
    }
  }

  async function handleTestOtp(e) {
    e.preventDefault();
    setErrorMsg("");
    setTestResult("");

    if (!user?.email) {
      setErrorMsg("Brak emaila użytkownika w sesji.");
      return;
    }
    if (!password || !otp) {
      setErrorMsg("Podaj hasło i kod z aplikacji.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Uwaga: tu nie zapisujemy tokena, to tylko test poprawności OTP
        body: JSON.stringify({
          email: user.email,
          password: password,
          otp: otp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.detail === "INVALID_OTP") {
          setTestResult("❌ Kod niepoprawny.");
          return;
        }
        if (data?.detail === "OTP_REQUIRED") {
          setTestResult("Włączone 2FA – wprowadź kod i spróbuj ponownie.");
          return;
        }
        throw new Error(data?.detail || "Błąd podczas testu OTP.");
      }
      setTestResult("✅ Kod poprawny (logowanie OK).");
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      setTestResult("🔑 Skopiowano sekret do schowka.");
      setTimeout(() => setTestResult(""), 1500);
    });
  }

  if (!user) return null;

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.inner}>
        <h1>Ustawienia konta</h1>

        <section className={styles.card}>
          <h2>Dwuskładnikowe uwierzytelnianie (2FA)</h2>
          <p className={styles.note}>
            Użyj aplikacji <strong>Google Authenticator</strong> (lub Microsoft Authenticator / FreeOTP), aby generować jednorazowe kody.
          </p>

          <div className={styles.row}>
            <div><b>Status:</b></div>
            <div>{totpEnabled ? "Włączone" : "Wyłączone"}</div>
          </div>

          <div className={styles.row}>
            <label htmlFor="pwd">Hasło do potwierdzenia:</label>
            <input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {!totpEnabled ? (
            <button
              className={styles.primary}
              onClick={handleEnable2FA}
              disabled={loadingSetup}
            >
              {loadingSetup ? "Włączanie…" : "Włącz 2FA i pobierz QR"}
            </button>
          ) : (
            <button
              className={styles.danger}
              onClick={handleDisable2FA}
              disabled={loadingDisable}
            >
              {loadingDisable ? "Wyłączanie…" : "Wyłącz 2FA"}
            </button>
          )}

          {qrDataUrl && (
            <div className={styles.qrBlock}>
              <h3>Zeskanuj ten kod w aplikacji</h3>
              <img src={qrDataUrl} alt="QR do konfiguracji TOTP" className={styles.qr} />
              <div className={styles.secretRow}>
                <div>
                  <div><b>Sekret (zapasowo):</b></div>
                  <code className={styles.secret}>{secret}</code>
                </div>
                <button className={styles.copyBtn} onClick={copySecret}>Kopiuj</button>
              </div>
              <details className={styles.uriDetails}>
                <summary>Pokaż otpauth URI</summary>
                <code className={styles.uri}>{otpauthUri}</code>
              </details>
            </div>
          )}

          {totpEnabled && (
            <form onSubmit={handleTestOtp} className={styles.testForm}>
              <h3>Przetestuj kod</h3>
              <div className={styles.row}>
                <label htmlFor="otp">Kod z aplikacji:</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <button className={styles.secondary} type="submit">Sprawdź kod</button>
            </form>
          )}

          {(errorMsg || testResult) && (
            <div className={styles.messages}>
              {errorMsg && <p className={styles.error}>{errorMsg}</p>}
              {testResult && <p className={styles.info}>{testResult}</p>}
            </div>
          )}

          <div className={styles.tools}>
            <button className={styles.linkBtn} onClick={refreshUser} disabled={loadingRefresh}>
              {loadingRefresh ? "Odświeżanie…" : "Odśwież dane użytkownika"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
