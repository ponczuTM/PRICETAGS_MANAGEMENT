import React, { useEffect, useState } from "react";
import styles from "./Settings.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000/api/priceusers";

export default function Settings() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  // 2FA (z Twojej wersji)
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [otpauthUri, setOtpauthUri] = useState(null);
  const [otp, setOtp] = useState("");
  const [testResult, setTestResult] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Edycje prostych pól
  const [firstName, setFirstName] = useState("");
  const [firstNameSaving, setFirstNameSaving] = useState(false);
  const [firstNameMsg, setFirstNameMsg] = useState("");

  const [lastName, setLastName] = useState("");
  const [lastNameSaving, setLastNameSaving] = useState(false);
  const [lastNameMsg, setLastNameMsg] = useState("");

  const [locationName, setLocationName] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  // Zmiana emaila
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmail2, setNewEmail2] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // Zmiana hasła
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/");
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    setTotpEnabled(!!parsed.totp_enabled);

    // wstępne wartości dla prostych inputów
    setFirstName(parsed.first_name || "");
    setLastName(parsed.last_name || "");
    setLocationName(parsed.locationName || "");
    setOldEmail(parsed.email || "");
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
        // odśwież inputy
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setLocationName(data.locationName || "");
        setOldEmail(data.email || "");
      } else {
        throw new Error(data?.detail || "Nie udało się odświeżyć użytkownika.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingRefresh(false);
    }
  }

  // --- Helpers ---
  async function fetchJson(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data?.detail || "Wystąpił błąd.";
      throw new Error(msg);
    }
    return data;
  }

  async function verifyCredentialsWithOptionalOtp(pwdPlain, maybeOtp) {
    // weryfikujemy hasło obecne przez /login (OTP opcjonalne)
    try {
      const payload = {
        email: user.email,
        password: pwdPlain,
      };
      if (maybeOtp?.trim()) payload.otp = maybeOtp.trim();

      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };

      // 2FA: brak OTP albo zły
      if (data?.detail === "OTP_REQUIRED") {
        return { ok: false, otpRequired: true, message: "Wymagany kod OTP." };
      }
      if (data?.detail === "INVALID_OTP") {
        return { ok: false, invalidOtp: true, message: "Niepoprawny kod OTP." };
      }
      return { ok: false, message: data?.detail || "Niepoprawne dane logowania." };
    } catch (e) {
      return { ok: false, message: e.message || "Błąd weryfikacji hasła." };
    }
  }

  // --- 2FA (Twoja część) ---
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

  // --- Save simple fields ---
  async function saveFirstName() {
    if (!firstName.trim()) {
      setFirstNameMsg("Podaj imię.");
      return;
    }
    if (!user?._id) return;

    try {
      setFirstNameSaving(true);
      setFirstNameMsg("");
      const data = await fetchJson(`${API_BASE}/${user._id}/first-name`, {
        method: "PATCH",
        body: JSON.stringify({ first_name: firstName.trim() }),
      });
      setFirstNameMsg("✅ Zapisano.");
      // zaktualizuj usera lokalnie
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setFirstNameMsg(`❌ ${e.message}`);
    } finally {
      setFirstNameSaving(false);
    }
  }

  async function saveLastName() {
    if (!lastName.trim()) {
      setLastNameMsg("Podaj nazwisko.");
      return;
    }
    if (!user?._id) return;

    try {
      setLastNameSaving(true);
      setLastNameMsg("");
      const data = await fetchJson(`${API_BASE}/${user._id}/last-name`, {
        method: "PATCH",
        body: JSON.stringify({ last_name: lastName.trim() }),
      });
      setLastNameMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setLastNameMsg(`❌ ${e.message}`);
    } finally {
      setLastNameSaving(false);
    }
  }

  async function saveLocationName() {
    if (!locationName.trim()) {
      setLocationMsg("Podaj nazwę lokalizacji.");
      return;
    }
    if (!user?._id) return;

    try {
      setLocationSaving(true);
      setLocationMsg("");
      const data = await fetchJson(`${API_BASE}/${user._id}/location-name`, {
        method: "PATCH",
        body: JSON.stringify({ locationName: locationName.trim() }),
      });
      setLocationMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setLocationMsg(`❌ ${e.message}`);
    } finally {
      setLocationSaving(false);
    }
  }

  // --- Save EMAIL (requires old + 2× new + password (+ optional OTP)) ---
  async function saveEmail() {
    setEmailMsg("");
    if (!user?._id) return;

    if (!oldEmail.trim()) return setEmailMsg("Podaj obecny email.");
    if (oldEmail.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
      return setEmailMsg("Obecny email nie zgadza się z zapisanym.");
    }
    if (!newEmail.trim() || !newEmail2.trim()) {
      return setEmailMsg("Podaj nowy email dwa razy.");
    }
    if (newEmail.trim().toLowerCase() !== newEmail2.trim().toLowerCase()) {
      return setEmailMsg("Nowe emaile nie są takie same.");
    }
    if (!emailPwd.trim()) {
      return setEmailMsg("Podaj obecne hasło.");
    }

    try {
      setEmailSaving(true);

      // krok 1: weryfikacja hasła (i ewentualnie OTP)
      const v = await verifyCredentialsWithOptionalOtp(emailPwd, emailOtp);
      if (!v.ok) {
        if (v.otpRequired) return setEmailMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setEmailMsg("Niepoprawny kod OTP.");
        return setEmailMsg(v.message || "Weryfikacja nieudana.");
      }

      // krok 2: zmiana emaila
      const data = await fetchJson(`${API_BASE}/${user._id}/email`, {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      });

      setEmailMsg("✅ Email zmieniony.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      // reset nowych wartości
      setNewEmail("");
      setNewEmail2("");
      setEmailPwd("");
      setEmailOtp("");
    } catch (e) {
      setEmailMsg(`❌ ${e.message}`);
    } finally {
      setEmailSaving(false);
    }
  }

  // --- Save PASSWORD (requires old + 2× new (+ optional OTP)) ---
  async function savePassword() {
    setPwdMsg("");
    if (!user?._id) return;
  
    if (!oldPwd) return setPwdMsg("Podaj obecne hasło.");
    if (!newPwd || !newPwd2) {
      return setPwdMsg("Podaj nowe hasło dwa razy.");
    }
  
    // ✅ NOWE: walidacja długości
    if (newPwd.length < 8 || newPwd2.length < 8) {
      return setPwdMsg("Nowe hasło musi mieć co najmniej 8 znaków.");
    }
  
    if (newPwd !== newPwd2) {
      return setPwdMsg("Nowe hasła nie są takie same.");
    }
  
    try {
      setPwdSaving(true);
  
      // weryfikacja obecnego hasła (+ ewentualnie OTP)
      const v = await verifyCredentialsWithOptionalOtp(oldPwd, pwdOtp);
      if (!v.ok) {
        if (v.otpRequired) return setPwdMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setPwdMsg("Niepoprawny kod OTP.");
        return setPwdMsg(v.message || "Weryfikacja nieudana.");
      }
  
      // zmiana hasła
      const data = await fetchJson(`${API_BASE}/${user._id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPwd }),
      });
  
      setPwdMsg("✅ Hasło zmienione.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
  
      // reset pól
      setOldPwd("");
      setNewPwd("");
      setNewPwd2("");
      setPwdOtp("");
    } catch (e) {
      setPwdMsg(`❌ ${e.message}`);
    } finally {
      setPwdSaving(false);
    }
  }
  

  if (!user) return null;

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.inner}>
        <h1>Ustawienia konta</h1>

        {/* Proste pola: imię, nazwisko, lokalizacja */}
        <section className={styles.card}>
          <h2>Dane profilu</h2>

          <div className={styles.row}>
            <label>Imię</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Imię"
              />
              <button
                className={styles.secondary}
                onClick={saveFirstName}
                disabled={firstNameSaving}
              >
                {firstNameSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {firstNameMsg && <div className={styles.noteLine}>{firstNameMsg}</div>}
          </div>

          <div className={styles.row}>
            <label>Nazwisko</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nazwisko"
              />
              <button
                className={styles.secondary}
                onClick={saveLastName}
                disabled={lastNameSaving}
              >
                {lastNameSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {lastNameMsg && <div className={styles.noteLine}>{lastNameMsg}</div>}
          </div>

          <div className={styles.row}>
            <label>Nazwa lokalizacji</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="np. Toronto"
              />
              <button
                className={styles.secondary}
                onClick={saveLocationName}
                disabled={locationSaving}
              >
                {locationSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {locationMsg && <div className={styles.noteLine}>{locationMsg}</div>}
          </div>
        </section>

        {/* Zmiana emaila */}
        <section className={styles.card}>
          <h2>Zmiana emaila</h2>

          <div className={styles.row}>
            <label>Obecny email</label>
            <input
              type="email"
              value={oldEmail}
              onChange={(e) => setOldEmail(e.target.value)}
              placeholder="obecny@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Nowy email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nowy@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Powtórz nowy email</label>
            <input
              type="email"
              value={newEmail2}
              onChange={(e) => setNewEmail2(e.target.value)}
              placeholder="nowy@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Obecne hasło</label>
            <input
              type="password"
              value={emailPwd}
              onChange={(e) => setEmailPwd(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {totpEnabled && (
            <div className={styles.row}>
              <label>Kod OTP (2FA)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
          )}

          <button
            className={styles.primary}
            onClick={saveEmail}
            disabled={emailSaving}
          >
            {emailSaving ? "Zapisywanie…" : "Zapisz email"}
          </button>

          {emailMsg && <div className={styles.messages}>
            <p className={emailMsg.startsWith("✅") ? styles.info : styles.error}>
              {emailMsg}
            </p>
          </div>}
        </section>

        {/* Zmiana hasła */}
        <section className={styles.card}>
          <h2>Zmiana hasła</h2>

          <div className={styles.row}>
            <label>Obecne hasło</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.row}>
            <label>Nowe hasło</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="min. 8 znaków"
              autoComplete="new-password"
            />
          </div>

          <div className={styles.row}>
            <label>Powtórz nowe hasło</label>
            <input
              type="password"
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              placeholder="powtórz nowe hasło"
              autoComplete="new-password"
            />
          </div>

          {totpEnabled && (
            <div className={styles.row}>
              <label>Kod OTP (2FA)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={pwdOtp}
                onChange={(e) => setPwdOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
          )}

          <button
            className={styles.primary}
            onClick={savePassword}
            disabled={pwdSaving}
          >
            {pwdSaving ? "Zapisywanie…" : "Zapisz hasło"}
          </button>

          {pwdMsg && <div className={styles.messages}>
            <p className={pwdMsg.startsWith("✅") ? styles.info : styles.error}>
              {pwdMsg}
            </p>
          </div>}
        </section>

        {/* 2FA */}
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
                  <div><b>Sekret (jeśli nie można skanować QR):</b></div>
                  <code className={styles.secret}>{secret}</code>
                </div>
              </div>
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
