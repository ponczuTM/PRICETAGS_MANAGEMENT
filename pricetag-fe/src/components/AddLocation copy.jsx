import React, { useState, useEffect } from "react";
import styles from "./AddLocation.module.css";
import Navbar from "./Navbar"; // ✅ import Navbar

const API_BASE = "http://0.0.0.0:8000";

const AddLocation = () => {
  const [locationId, setLocationId] = useState("");
  const [user, setUser] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [message, setMessage] = useState("");

  // ✅ nowy stan na wszystkie ID lokalizacji z bazy
  const [allLocationIds, setAllLocationIds] = useState([]);

  const token = localStorage.getItem("token");
  const storedUser = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (storedUser) {
      setUser(storedUser);
      fetchAssignedLocations(storedUser._id);
    }
    loadAllLocations(); // ✅ wczytaj wszystkie lokalizacje na starcie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ helper do pobrania wszystkich lokalizacji (tylko ID)
  const loadAllLocations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/locations`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = Array.isArray(data)
        ? data.map((loc) => loc._id || loc.id).filter(Boolean)
        : [];
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
            if (resp.ok) {
              return await resp.json();
            } else {
              return { _id: locId, name: "?", address: "?", error: "Nie znaleziono w bazie" };
            }
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
      // sprawdź czy istnieje w bazie
      const resp = await fetch(`${API_BASE}/api/locations/${locationId}`);
      if (!resp.ok) {
        setMessage("❌ Lokalizacja nie istnieje w bazie");
        return;
      }
      const location = await resp.json();

      // dopisz do przypisań usera (unikalne)
      const updatedLocationIds = [...new Set([...(user.locationIds || []), locationId])];

      const res = await fetch(`${API_BASE}/api/priceusers/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });

      if (!res.ok) throw new Error("Błąd aktualizacji użytkownika");

      // zapisz w stanie i localStorage
      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));

      setAssignedLocations([...assignedLocations, location]);
      setLocationId("");
      setMessage("✅ Lokalizacja dodana do użytkownika");

      // ✅ odśwież listę wszystkich ID z bazy (na wypadek, gdy baza się zmieniła)
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
      setAssignedLocations(assignedLocations.filter((l) => l._id !== locId));

      // (opcjonalnie) odśwież all ids – raczej nie zmienia to listy wszystkich w bazie,
      // ale nie zaszkodzi utrzymać spójność
      loadAllLocations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLocation = async (locId, field, value) => {
    const updated = assignedLocations.map((loc) =>
      loc._id === locId ? { ...loc, [field]: value, dirty: true } : loc
    );
    setAssignedLocations(updated);
  };

  const handleSaveLocation = async (loc) => {
    try {
      const res = await fetch(`${API_BASE}/api/locations/${loc._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: loc.name, address: loc.address }),
      });

      if (!res.ok) throw new Error("Błąd zapisu lokalizacji");

      const updated = assignedLocations.map((l) =>
        l._id === loc._id ? { ...loc, dirty: false } : l
      );
      setAssignedLocations(updated);
      setMessage("✅ Zapisano zmiany lokalizacji");
    } catch (err) {
      console.error(err);
      setMessage("❌ Błąd zapisu lokalizacji");
    }
  };

  return (
    <div>
      {/* ✅ Navbar pojawia się tylko jeśli user ma co najmniej jedną lokalizację */}
      {assignedLocations.length > 0 && <Navbar />}

      <div className={styles.container}>
        <h1>Ustawienia Lokalizacji</h1>

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

        {/* ✅ Lista WSZYSTKICH lokalizacji z bazy (ID) */}
        <div className={styles.card}>
          <h3>Wszystkie lokalizacje w bazie (ID)</h3>
          {allLocationIds.length === 0 ? (
            <p className={styles.note}>Brak lokalizacji w bazie.</p>
          ) : (
            <ul>
              {allLocationIds.map((id) => (
                <li key={id}>
                  <code>{id}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddLocation;
