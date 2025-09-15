import React, { useState, useEffect } from "react";
import styles from "./AddLocation.module.css";
import Navbar from "./Navbar"; // ✅ import Navbar

const AddLocation = () => {
  const [locationId, setLocationId] = useState("");
  const [user, setUser] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");
  const storedUser = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (storedUser) {
      setUser(storedUser);
      fetchAssignedLocations(storedUser._id);
    }
  }, []);

  const fetchAssignedLocations = async (userId) => {
    try {
      const res = await fetch(`http://0.0.0.0:8000/api/priceusers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Błąd pobierania użytkownika");
      const data = await res.json();

      if (Array.isArray(data.locationIds)) {
        const locations = await Promise.all(
          data.locationIds.map(async (locId) => {
            const resp = await fetch(`http://0.0.0.0:8000/api/locations/${locId}`);
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
    if (!locationId.trim()) return;

    try {
      const resp = await fetch(`http://0.0.0.0:8000/api/locations/${locationId}`);
      if (!resp.ok) {
        setMessage("❌ Lokalizacja nie istnieje w bazie");
        return;
      }
      const location = await resp.json();

      const updatedLocationIds = [...new Set([...(user.locationIds || []), locationId])];

      const res = await fetch(`http://0.0.0.0:8000/api/priceusers/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });

      if (!res.ok) throw new Error("Błąd aktualizacji użytkownika");

      setUser({ ...user, locationIds: updatedLocationIds });
      localStorage.setItem("user", JSON.stringify({ ...user, locationIds: updatedLocationIds }));
      setAssignedLocations([...assignedLocations, location]);
      setLocationId("");
      setMessage("✅ Lokalizacja dodana do użytkownika");
    } catch (err) {
      console.error(err);
      setMessage("❌ Błąd podczas dodawania lokalizacji");
    }
  };

  const handleRemove = async (locId) => {
    try {
      const updatedLocationIds = (user.locationIds || []).filter((id) => id !== locId);

      const res = await fetch(`http://0.0.0.0:8000/api/priceusers/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });

      if (!res.ok) throw new Error("Błąd usuwania lokalizacji");

      setUser({ ...user, locationIds: updatedLocationIds });
      localStorage.setItem("user", JSON.stringify({ ...user, locationIds: updatedLocationIds }));
      setAssignedLocations(assignedLocations.filter((l) => l._id !== locId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLocation = async (locId, field, value) => {
    try {
      const updated = assignedLocations.map((loc) =>
        loc._id === locId ? { ...loc, [field]: value, dirty: true } : loc
      );
      setAssignedLocations(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLocation = async (loc) => {
    try {
      const res = await fetch(`http://0.0.0.0:8000/api/locations/${loc._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      </div>
    </div>
    
  );
};

export default AddLocation;
