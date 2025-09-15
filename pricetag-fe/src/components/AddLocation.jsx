import React, { useState, useEffect, useRef } from "react";
import styles from "./AddLocation.module.css";
import Navbar from "./Navbar";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

const AddLocation = () => {
  const [locationId, setLocationId] = useState("");
  const [user, setUser] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [message, setMessage] = useState("");
  const [allLocationIds, setAllLocationIds] = useState([]);

  // === QR scanner state ===
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const detectorRef = useRef(null);
  const fileInputRef = useRef(null); // NEW: fallback przez zdjęcie

  const token = localStorage.getItem("token");
  const storedUser = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (storedUser) {
      setUser(storedUser);
      fetchAssignedLocations(storedUser._id);
    }
    loadAllLocations();
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllLocations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/locations`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = Array.isArray(data) ? data.map(l => l._id || l.id).filter(Boolean) : [];
      setAllLocationIds(ids);
    } catch (e) {
      console.error("Nie udało się pobrać wszystkich lokalizacji:", e);
    }
  };

  const fetchAssignedLocations = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/priceusers/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Błąd pobierania użytkownika");
      const data = await res.json();
      if (Array.isArray(data.locationIds)) {
        const locations = await Promise.all(
          data.locationIds.map(async (locId) => {
            const resp = await fetch(`${API_BASE}/api/locations/${locId}`);
            return resp.ok
              ? await resp.json()
              : { _id: locId, name: "?", address: "?", error: "Nie znaleziono w bazie" };
          })
        );
        setAssignedLocations(locations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLocation = async () => {
    if (!locationId.trim() || !user?._id) return;
    try {
      const resp = await fetch(`${API_BASE}/api/locations/${locationId}`);
      if (!resp.ok) {
        setMessage("❌ Lokalizacja nie istnieje w bazie");
        return;
      }
      const location = await resp.json();
      const updatedLocationIds = [...new Set([...(user.locationIds || []), locationId])];
      const res = await fetch(`${API_BASE}/api/priceusers/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd aktualizacji użytkownika");
      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations([...assignedLocations, location]);
      setLocationId("");
      setMessage("✅ Lokalizacja dodana do użytkownika");
      loadAllLocations();
    } catch (err) {
      console.error(err);
      setMessage("❌ Błąd podczas dodawania lokalizacji");
    }
  };

  const handleRemove = async (locId) => {
    if (!user?._id) return;
    try {
      const updatedLocationIds = (user.locationIds || []).filter((id) => id !== locId);
      const res = await fetch(`${API_BASE}/api/priceusers/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd usuwania lokalizacji");
      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations(assignedLocations.filter((l) => l._id !== locId));
      loadAllLocations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLocation = (locId, field, value) => {
    setAssignedLocations(list =>
      list.map(loc => (loc._id === locId ? { ...loc, [field]: value, dirty: true } : loc))
    );
  };

  const handleSaveLocation = async (loc) => {
    try {
      const res = await fetch(`${API_BASE}/api/locations/${loc._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: loc.name, address: loc.address }),
      });
      if (!res.ok) throw new Error("Błąd zapisu lokalizacji");
      setAssignedLocations(list =>
        list.map(l => (l._id === loc._id ? { ...loc, dirty: false } : l))
      );
      setMessage("✅ Zapisano zmiany lokalizacji");
    } catch (err) {
      console.error(err);
      setMessage("❌ Błąd zapisu lokalizacji");
    }
  };

  // ========= QR Scanner =========
  const openScanner = async () => {
    setScanError("");
    // NEW: sprawdź secure context
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
  };

  const scanLoopWithDetector = async () => {
    const tick = async () => {
      if (!detectorRef.current || !videoRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        const qr = Array.isArray(codes) ? codes.find((c) => c.rawValue) : null;
        if (qr?.rawValue) {
          setLocationId(qr.rawValue.trim());
          stopScanner();
          setShowScanner(false);
          setMessage("📥 Wklejono wynik QR do pola.");
          return;
        }
      } catch {}
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopScanner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  };

  const closeScanner = () => {
    stopScanner();
    setShowScanner(false);
  };

  // NEW: fallback – zeskanuj z pliku (zdjęcia)
  const pickImageForScan = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const onPickedImage = async (e) => {
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
      const qr = Array.isArray(codes) ? codes.find(c => c.rawValue) : null;
      if (qr?.rawValue) {
        setLocationId(qr.rawValue.trim());
        setShowScanner(false);
        setMessage("📥 Wklejono wynik QR ze zdjęcia.");
      } else {
        setScanError("Nie udało się odczytać kodu QR ze zdjęcia.");
      }
    } catch (err) {
      console.error(err);
      setScanError("Błąd podczas analizy zdjęcia.");
    }
  };

  return (
    <div>
      {assignedLocations.length > 0 && <Navbar />}

      <div className={styles.container}>
        <div className={styles.card}>
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
            <button
              type="button"
              className={styles.secondary}
              title="Zeskanuj QR"
              onClick={openScanner}
            >
              {/* ikona kamery (SVG) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
          {message && <p className={styles.info}>{message}</p>}
        </div>

        <div className={styles.card}>
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
                    <td><code>{loc._id}</code></td>
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
        </div>
      </div>

      {/* Modal skanera */}
      {showScanner && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
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
                position: "absolute", inset: 16,
                border: "2px dashed rgba(255,255,255,0.7)",
                borderRadius: 10, pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute", top: 8, left: 8, right: 8,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                color: "#fff", fontWeight: 600, textShadow: "0 1px 2px rgba(0,0,0,.6)",
              }}
            >
              <span>Skieruj aparat na kod QR</span>
              <div style={{ display: "flex", gap: 8 }}>
                {/* NEW: fallback – wybór zdjęcia */}
                <button
                  onClick={pickImageForScan}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff", border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                  }}
                >
                  Wczytaj zdjęcie
                </button>
                <button
                  onClick={closeScanner}
                  style={{
                    background: "rgba(0,0,0,0.5)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>

            {scanError && (
              <div
                style={{
                  position: "absolute", bottom: 8, left: 8, right: 8,
                  color: "#fee2e2", background: "rgba(239,68,68,0.25)",
                  border: "1px solid rgba(239,68,68,0.55)",
                  padding: "8px 10px", borderRadius: 8, fontSize: 12,
                }}
              >
                {scanError}
              </div>
            )}
          </div>

          {/* ukryty input do wczytania zdjęcia (fallback) */}
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
  );
};

export default AddLocation;
