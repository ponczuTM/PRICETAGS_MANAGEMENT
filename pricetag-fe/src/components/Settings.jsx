

import React, { useEffect, useRef, useState } from "react";
import styles from "./Settings.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_ROOT = import.meta.env.VITE_BACKEND_URL;
const API_PRICEUSERS = `${API_ROOT}/api/priceusers`;
const API_LOCATIONS = `${API_ROOT}/api/locations`;

export default function Settings() {
  const navigate = useNavigate();

  // --- User / Navbar visibility ---
  const [user, setUser] = useState(null);
  const hasAnyLocation = (user?.locationIds?.length || 0) > 0;

  // --- 2FA state ---
  const [totpEnabled, setTotpEnabled] = useState(false);
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

  // --- Simple profile fields ---
  const [firstName, setFirstName] = useState("");
  const [firstNameSaving, setFirstNameSaving] = useState(false);
  const [firstNameMsg, setFirstNameMsg] = useState("");

  const [lastName, setLastName] = useState("");
  const [lastNameSaving, setLastNameSaving] = useState(false);
  const [lastNameMsg, setLastNameMsg] = useState("");

  const [locationName, setLocationName] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  // --- Email change ---
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmail2, setNewEmail2] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // --- Password change ---
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  // --- Locations (moved from AddLocation) ---
  const token = localStorage.getItem("token");
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [allLocationIds, setAllLocationIds] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [locMessage, setLocMessage] = useState("");

  // QR scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const detectorRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Init ---
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/");
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    setTotpEnabled(!!parsed.totp_enabled);

    setFirstName(parsed.first_name || "");
    setLastName(parsed.last_name || "");
    setLocationName(parsed.locationName || "");
    setOldEmail(parsed.email || "");

    // load locations
    if (parsed?._id) {
      fetchAssignedLocations(parsed._id, parsed.locationIds || []);
    }
    loadAllLocations();

    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

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
    try {
      const payload = {
        email: user.email,
        password: pwdPlain,
      };
      if (maybeOtp?.trim()) payload.otp = maybeOtp.trim();

      const res = await fetch(`${API_PRICEUSERS}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };

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

  async function refreshUser() {
    try {
      if (!user?._id) return;
      setLoadingRefresh(true);
      const res = await fetch(`${API_PRICEUSERS}/${user._id}`);
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setTotpEnabled(!!data.totp_enabled);
        localStorage.setItem("user", JSON.stringify(data));
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setLocationName(data.locationName || "");
        setOldEmail(data.email || "");
        // refresh assigned locations
        await fetchAssignedLocations(data._id, data.locationIds || []);
      } else {
        throw new Error(data?.detail || "Nie udało się odświeżyć użytkownika.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingRefresh(false);
    }
  }

  // --- 2FA handlers ---
  async function handleEnable2FA(e) {
    e.preventDefault();
    setErrorMsg("");
    setTestResult("");
    setQrDataUrl(null);
    setSecret(null);
    setOtpauthUri(null);

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password) return setErrorMsg("Podaj hasło, aby potwierdzić.");

    try {
      setLoadingSetup(true);
      const res = await fetch(`${API_PRICEUSERS}/totp/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Nie udało się włączyć 2FA.");
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

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password) return setErrorMsg("Podaj hasło, aby potwierdzić.");

    try {
      setLoadingDisable(true);
      const res = await fetch(`${API_PRICEUSERS}/totp/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Nie udało się wyłączyć 2FA.");
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

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password || !otp) return setErrorMsg("Podaj hasło i kod z aplikacji.");

    try {
      const res = await fetch(`${API_PRICEUSERS}/login`, {
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
        if (data?.detail === "INVALID_OTP") return setTestResult("❌ Kod niepoprawny.");
        if (data?.detail === "OTP_REQUIRED") return setTestResult("Włączone 2FA – wprowadź kod i spróbuj ponownie.");
        throw new Error(data?.detail || "Błąd podczas testu OTP.");
      }
      setTestResult("✅ Kod poprawny (logowanie OK).");
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  // --- Save simple fields ---
  async function saveFirstName() {
    if (!firstName.trim()) return setFirstNameMsg("Podaj imię.");
    if (!user?._id) return;
    try {
      setFirstNameSaving(true);
      setFirstNameMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/first-name`, {
        method: "PATCH",
        body: JSON.stringify({ first_name: firstName.trim() }),
      });
      setFirstNameMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setFirstNameMsg(`❌ ${e.message}`);
    } finally {
      setFirstNameSaving(false);
    }
  }

  async function saveLastName() {
    if (!lastName.trim()) return setLastNameMsg("Podaj nazwisko.");
    if (!user?._id) return;
    try {
      setLastNameSaving(true);
      setLastNameMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/last-name`, {
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
    if (!locationName.trim()) return setLocationMsg("Podaj nazwę lokalizacji.");
    if (!user?._id) return;
    try {
      setLocationSaving(true);
      setLocationMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/location-name`, {
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

  // --- Save EMAIL ---
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

      const v = await verifyCredentialsWithOptionalOtp(emailPwd, emailOtp);
      if (!v.ok) {
        if (v.otpRequired) return setEmailMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setEmailMsg("Niepoprawny kod OTP.");
        return setEmailMsg(v.message || "Weryfikacja nieudana.");
      }

      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/email`, {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      });

      setEmailMsg("✅ Email zmieniony.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
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

  // --- Save PASSWORD ---
  async function savePassword() {
    setPwdMsg("");
    if (!user?._id) return;

    if (!oldPwd) return setPwdMsg("Podaj obecne hasło.");
    if (!newPwd || !newPwd2) return setPwdMsg("Podaj nowe hasło dwa razy.");
    if (newPwd.length < 8 || newPwd2.length < 8) {
      return setPwdMsg("Nowe hasło musi mieć co najmniej 8 znaków.");
    }
    if (newPwd !== newPwd2) return setPwdMsg("Nowe hasła nie są takie same.");

    try {
      setPwdSaving(true);

      const v = await verifyCredentialsWithOptionalOtp(oldPwd, pwdOtp);
      if (!v.ok) {
        if (v.otpRequired) return setPwdMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setPwdMsg("Niepoprawny kod OTP.");
        return setPwdMsg(v.message || "Weryfikacja nieudana.");
      }

      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPwd }),
      });

      setPwdMsg("✅ Hasło zmienione.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
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

  // =========================
  // Locations (merged AddLocation)
  // =========================
  async function loadAllLocations() {
    try {
      const res = await fetch(`${API_LOCATIONS}`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = Array.isArray(data) ? data.map(l => l._id || l.id).filter(Boolean) : [];
      setAllLocationIds(ids);
    } catch (e) {
      console.error("Nie udało się pobrać wszystkich lokalizacji:", e);
    }
  }

  async function fetchAssignedLocations(userId, locationIdsArr) {
    try {
      const res = await fetch(`${API_PRICEUSERS}/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Błąd pobierania użytkownika");
      const data = await res.json();

      const ids = Array.isArray(data.locationIds) ? data.locationIds : (locationIdsArr || []);
      if (Array.isArray(ids)) {
        const locations = await Promise.all(
          ids.map(async (locId) => {
            const resp = await fetch(`${API_LOCATIONS}/${locId}`);
            return resp.ok
              ? await resp.json()
              : { _id: locId, name: "?", address: "?", error: "Nie znaleziono w bazie" };
          })
        );
        setAssignedLocations(locations);
      } else {
        setAssignedLocations([]);
      }
    } catch (err) {
      console.error(err);
      setAssignedLocations([]);
    }
  }

  async function handleAddLocation() {
    if (!locationId.trim() || !user?._id) return;
    try {
      const resp = await fetch(`${API_LOCATIONS}/${locationId}`);
      if (!resp.ok) {
        setLocMessage("❌ Lokalizacja nie istnieje w bazie");
        return;
      }
      const location = await resp.json();
      const updatedLocationIds = [...new Set([...(user.locationIds || []), locationId])];

      const res = await fetch(`${API_PRICEUSERS}/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd aktualizacji użytkownika");

      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations((prev) => [...prev, location]);
      setLocationId("");
      setLocMessage("✅ Lokalizacja dodana do użytkownika");
      loadAllLocations();
    } catch (err) {
      console.error(err);
      setLocMessage("❌ Błąd podczas dodawania lokalizacji");
    }
  }

  async function handleRemove(locId) {
    if (!user?._id) return;
    try {
      const updatedLocationIds = (user.locationIds || []).filter((id) => id !== locId);
      const res = await fetch(`${API_PRICEUSERS}/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd usuwania lokalizacji");

      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations((list) => list.filter((l) => l._id !== locId));
      loadAllLocations();
    } catch (err) {
      console.error(err);
    }
  }

  function handleUpdateLocation(locId, field, value) {
    setAssignedLocations((list) =>
      list.map((loc) => (loc._id === locId ? { ...loc, [field]: value, dirty: true } : loc))
    );
  }

  async function handleSaveLocation(loc) {
    try {
      const res = await fetch(`${API_LOCATIONS}/${loc._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: loc.name, address: loc.address }),
      });
      if (!res.ok) throw new Error("Błąd zapisu lokalizacji");
      setAssignedLocations((list) =>
        list.map((l) => (l._id === loc._id ? { ...loc, dirty: false } : l))
      );
      setLocMessage("✅ Zapisano zmiany lokalizacji");
    } catch (err) {
      console.error(err);
      setLocMessage("❌ Błąd zapisu lokalizacji");
    }
  }

  // --- QR scanner helpers ---
  async function openScanner() {
    setScanError("");
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setScanError(
        "Kamera wymaga bezpiecznego połączenia. Otwórz stronę przez HTTPS lub na localhost. " +
          "Alternatywnie użyj przycisku 'Wczytaj zdjęcie' i zeskanuj QR ze zdjęcia."
      );
      setShowScanner(true);
      return;
    }

    setShowScanner(true);
    try {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
        throw new Error("API kamery niedostępne. Spróbuj przez HTTPS lub na localhost.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ("BarcodeDetector" in window) {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        scanLoopWithDetector();
      } else {
        throw new Error(
          "Brak wsparcia BarcodeDetector. Użyj przycisku 'Wczytaj zdjęcie' i zeskanuj QR ze zdjęcia."
        );
      }
    } catch (err) {
      console.error(err);
      setScanError(err.message || "Nie udało się uruchomić kamery.");
    }
  }

  function scanLoopWithDetector() {
    const tick = async () => {
      if (!detectorRef.current || !videoRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        const qr = Array.isArray(codes) ? codes.find((c) => c.rawValue) : null;
        if (qr?.rawValue) {
          setLocationId(qr.rawValue.trim());
          stopScanner();
          setShowScanner(false);
          setLocMessage("📥 Wklejono wynik QR do pola.");
          return;
        }
      } catch {}
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopScanner() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }

  function closeScanner() {
    stopScanner();
    setShowScanner(false);
  }

  function pickImageForScan() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  async function onPickedImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!("BarcodeDetector" in window)) {
      setScanError("Brak wsparcia BarcodeDetector – zaktualizuj przeglądarkę.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      const qr = Array.isArray(codes) ? codes.find((c) => c.rawValue) : null;
      if (qr?.rawValue) {
        setLocationId(qr.rawValue.trim());
        setShowScanner(false);
        setLocMessage("📥 Wklejono wynik QR ze zdjęcia.");
      } else {
        setScanError("Nie udało się odczytać kodu QR ze zdjęcia.");
      }
    } catch (err) {
      console.error(err);
      setScanError("Błąd podczas analizy zdjęcia.");
    }
  }

  if (!user) return null;

  return (
    <>
      {hasAnyLocation && <Navbar />}
    <div className={styles.container}>

      <div className={styles.inner}>
        <h1>Ustawienia konta</h1>

        {/* Dane profilu */}
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
              <button className={styles.secondary} onClick={saveFirstName} disabled={firstNameSaving}>
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
              <button className={styles.secondary} onClick={saveLastName} disabled={lastNameSaving}>
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
              <button className={styles.secondary} onClick={saveLocationName} disabled={locationSaving}>
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

          <button className={styles.primary} onClick={saveEmail} disabled={emailSaving}>
            {emailSaving ? "Zapisywanie…" : "Zapisz email"}
          </button>

          {emailMsg && (
            <div className={styles.messages}>
              <p className={emailMsg.startsWith("✅") ? styles.info : styles.error}>{emailMsg}</p>
            </div>
          )}
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

          <button className={styles.primary} onClick={savePassword} disabled={pwdSaving}>
            {pwdSaving ? "Zapisywanie…" : "Zapisz hasło"}
          </button>

          {pwdMsg && (
            <div className={styles.messages}>
              <p className={pwdMsg.startsWith("✅") ? styles.info : styles.error}>{pwdMsg}</p>
            </div>
          )}
        </section>

        {/* 2FA */}
        <section className={styles.card}>
          <h2>Dwuskładnikowe uwierzytelnianie (2FA)</h2>
          <p className={styles.note}>
            Użyj aplikacji <strong>Google Authenticator</strong> (lub Microsoft Authenticator / FreeOTP), aby
            generować jednorazowe kody.
          </p>

          <div className={styles.row}>
            <div>
              <b>Status:</b>
            </div>
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
            <button className={styles.primary} onClick={handleEnable2FA} disabled={loadingSetup}>
              {loadingSetup ? "Włączanie…" : "Włącz 2FA i pobierz QR"}
            </button>
          ) : (
            <button className={styles.danger} onClick={handleDisable2FA} disabled={loadingDisable}>
              {loadingDisable ? "Wyłączanie…" : "Wyłącz 2FA"}
            </button>
          )}

          {qrDataUrl && (
            <div className={styles.qrBlock}>
              <h3>Zeskanuj ten kod w aplikacji</h3>
              <img src={qrDataUrl} alt="QR do konfiguracji TOTP" className={styles.qr} />
              <div className={styles.secretRow}>
                <div>
                  <div>
                    <b>Sekret (jeśli nie można skanować QR):</b>
                  </div>
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
              <button className={styles.secondary} type="submit">
                Sprawdź kod
              </button>
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

        {/* ======= DODAWANIE LOKALIZACJI (scalone AddLocation) ======= */}
        <section className={styles.card}>
          <h2>Dodaj lokalizację</h2>
          <div className={styles.growRow}>
            <input
              type="text"
              placeholder="Wpisz ID lokalizacji"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            />
            <button className={styles.primary} onClick={handleAddLocation}>
              Dodaj
            </button>
            <button type="button" className={styles.secondary} title="Zeskanuj QR" onClick={openScanner}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          {locMessage && <p className={styles.info}>{locMessage}</p>}
        </section>

        <section className={styles.card}>
          <h3>Twoje lokalizacje</h3>
          {assignedLocations.length === 0 ? (
            <p className={styles.note}>Brak przypisanych lokalizacji.</p>
          ) : (
            
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nazwa</th>
                  <th>Adres</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {assignedLocations.map((loc) => (
                  <tr key={loc._id}>
                    <td>
                      <code>{loc._id}</code>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={loc.name || ""}
                        onChange={(e) => handleUpdateLocation(loc._id, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={loc.address || ""}
                        onChange={(e) => handleUpdateLocation(loc._id, "address", e.target.value)}
                      />
                    </td>
                    <td className={styles.actions}>
                      <button className={styles.primary} onClick={() => handleSaveLocation(loc)}>
                        Zapisz
                      </button>
                      <button className={styles.danger} onClick={() => handleRemove(loc._id)}>
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Modal skanera (QR) */}
      {showScanner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "min(90vw, 480px)",
              aspectRatio: "1 / 1",
              background: "#000",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.3)",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 16,
                border: "2px dashed rgba(255,255,255,0.7)",
                borderRadius: 10,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#fff",
                fontWeight: 600,
                textShadow: "0 1px 2px rgba(0,0,0,.6)",
              }}
            >
              <span>Skieruj aparat na kod QR</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={pickImageForScan}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Wczytaj zdjęcie
                </button>
                <button
                  onClick={closeScanner}
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>

            {scanError && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  right: 8,
                  color: "#fee2e2",
                  background: "rgba(239,68,68,0.25)",
                  border: "1px solid rgba(239,68,68,0.55)",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                {scanError}
              </div>
            )}
          </div>

          {/* ukryty input do fallbacku */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={onPickedImage}
          />
        </div>
      )}
    </div>
    </>
  );
}
