import React, { useEffect, useState, useRef } from "react";
import styles from "./Schedule.module.css";
import Navbar from "./Navbar";
import editIcon from "./../assets/images/edit.png";
import DatePicker, { registerLocale } from "react-datepicker";
import pl from "date-fns/locale/pl";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

registerLocale("pl", pl);

const API_BASE_URL = "http://localhost:8000/api/locations";

function Schedule() {
  const navigate = useNavigate();

  // === Pobranie usera i locationIds z localStorage (z fallbackiem na legacy) ===
  const storedUser = localStorage.getItem("user");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;

  const storedLocationIds = (() => {
    try {
      const arr = JSON.parse(localStorage.getItem("locationIds") || "[]");
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
    const legacy = localStorage.getItem("locationId");
    if (legacy) return [legacy];
    if (parsedUser?.locationIds && Array.isArray(parsedUser.locationIds) && parsedUser.locationIds.length > 0) {
      return parsedUser.locationIds;
    }
    return [];
  })();

  const [locationIds, setLocationIds] = useState(storedLocationIds);
  const [currentLocationId, setCurrentLocationId] = useState(() => {
    const legacy = localStorage.getItem("locationId");
    return legacy || (storedLocationIds.length > 0 ? storedLocationIds[0] : null);
  });

  // === Stany komponentu ===
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [activeTab, setActiveTab] = useState("gallery"); // domyślnie galeria
  const [errorMsg, setErrorMsg] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [selectedGalleryFile, setSelectedGalleryFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Harmonogram
  const [scheduleType, setScheduleType] = useState("fixed");
  const [dateTime, setDateTime] = useState(null);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  // Edycja nazw
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editedNames, setEditedNames] = useState(() => {
    const stored = localStorage.getItem("deviceNames");
    return stored ? JSON.parse(stored) : {};
  });
  const [editInputValue, setEditInputValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");

  // Listowanie istniejących harmonogramów
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [isScheduleListOpen, setIsScheduleListOpen] = useState(false);

  // Kontrola otwierania dymków DatePicker
  const [isFixedPickerOpen, setIsFixedPickerOpen] = useState(false);
  const [isWeeklyTimeOpen, setIsWeeklyTimeOpen] = useState(false);

  const videoRef = useRef(null);

  // Pomocnicze
  const getNowInWarsaw = () => {
    const parts = new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
    const take = (t) => parseInt(parts.find((p) => p.type === t)?.value, 10);
    return new Date(take("year"), take("month") - 1, take("day"), take("hour"), take("minute"));
  };

  const getDisplayName = (clientName) => editedNames[clientName] || clientName;

  // Guard: wymuś logowanie i posiadanie lokalizacji
  useEffect(() => {
    if (!parsedUser) {
      navigate("/");
      return;
    }
    if (!locationIds || locationIds.length === 0) {
      console.warn("Użytkownik nie ma przypisanych lokalizacji.");
      navigate("/");
      return;
    }
    if (!currentLocationId) {
      setCurrentLocationId(locationIds[0]);
      localStorage.setItem("locationId", locationIds[0]); // legacy zgodność
    }
  }, [parsedUser, locationIds, currentLocationId, navigate]);

  // Reaguj na zmianę lokalizacji
  useEffect(() => {
    if (!currentLocationId) return;
    fetchDevicesAndGroups(currentLocationId);
    if (isModalOpen && activeTab === "gallery") {
      fetchGalleryFiles(currentLocationId);
    }
    setSelectedDevices([]);
    setErrorMsg(null);
  }, [currentLocationId]);

  // Doładowuj galerię, gdy trzeba
  useEffect(() => {
    if (selectedDevices.length > 0 && isModalOpen && activeTab === "gallery" && currentLocationId) {
      fetchGalleryFiles(currentLocationId);
    }
  }, [selectedDevices, isModalOpen, activeTab, currentLocationId]);

  // Zamknij dymki przy przełączeniach
  useEffect(() => {
    setIsFixedPickerOpen(false);
    setIsWeeklyTimeOpen(false);
  }, [scheduleType, isModalOpen]);

  // ==== FETCH ====
  const fetchDevicesAndGroups = async (locId) => {
    try {
      const [devicesRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/${locId}/devices`),
        fetch(`${API_BASE_URL}/${locId}/groups`),
      ]);

      if (!devicesRes.ok || !groupsRes.ok) {
        throw new Error("Błąd pobierania urządzeń lub grup");
      }

      const devicesData = await devicesRes.json();
      const groupsData = await groupsRes.json();

      const processedDevices = (devicesData || []).map((device) => ({
        ...device,
        groups: device.groups || [],
      }));

      setDevices(processedDevices);
      setGroups(groupsData || []);
    } catch (err) {
      console.error("Błąd pobierania urządzeń lub grup:", err);
      setErrorMsg("Nie udało się załadować urządzeń lub grup.");
    }
  };

  const fetchGalleryFiles = async (locId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locId}/files/`);
      if (!res.ok) throw new Error("Błąd podczas pobierania listy plików z galerii");
      const data = await res.json();
      setGalleryFiles(data.files || []);
    } catch (err) {
      console.error("Błąd pobierania plików galerii:", err);
      setErrorMsg("Nie udało się załadować plików galerii.");
    }
  };

  // === Switcher lokalizacji (przyciski) ===
  const handleSwitchLocation = (locId) => {
    setCurrentLocationId(locId);
    localStorage.setItem("locationId", locId); // legacy zgodność
  };

  // === Edycja nazw ===
  const handleEditClick = (device) => {
    setEditingDeviceId(device._id);
    const currentName = editedNames[device.clientName] || "";
    setEditInputValue(currentName);
    setOriginalValue(currentName);
  };

  const handleEditSave = (clientName) => {
    const updated = { ...editedNames, [clientName]: editInputValue };
    setEditedNames(updated);
    localStorage.setItem("deviceNames", JSON.stringify(updated));
    setEditingDeviceId(null);
    setOriginalValue("");
  };

  const handleEditReset = (clientName) => {
    const updated = { ...editedNames };
    delete updated[clientName];
    setEditedNames(updated);
    localStorage.setItem("deviceNames", JSON.stringify(updated));
    setEditingDeviceId(null);
    setOriginalValue("");
  };

  const handleEditCancel = () => {
    setEditInputValue(originalValue);
    setEditingDeviceId(null);
    setOriginalValue("");
  };

  // === Selekcja urządzeń ===
  const handleDeviceSelectToggle = (device) => {
    setSelectedDevices((prevSelected) => {
      const newSelected = prevSelected.some((d) => d._id === device._id)
        ? prevSelected.filter((d) => d._id !== device._id)
        : [...prevSelected, device];
      return newSelected;
    });
    setErrorMsg(null);
  };

  const handleGroupSelectAllToggle = (groupId) => {
    const devicesInGroup = devices.filter((device) =>
      groupId === null ? (device.groups || []).length === 0 : (device.groups || []).includes(groupId)
    );

    const onlineDevicesInGroup = devicesInGroup.filter((d) => d.isOnline);
    const allSelectedOnline = onlineDevicesInGroup.every((d) => selectedDevices.some((s) => s._id === d._id));

    setSelectedDevices((prevSelected) => {
      let newSelected = [...prevSelected];

      if (allSelectedOnline) {
        // Odznacz wszystkie online
        newSelected = newSelected.filter((d) => !onlineDevicesInGroup.some((x) => x._id === d._id));
      } else {
        // Zaznacz tylko online i niepowtórzone
        onlineDevicesInGroup.forEach((d) => {
          if (!newSelected.some((x) => x._id === d._id)) newSelected.push(d);
        });
      }

      return newSelected;
    });

    setErrorMsg(null);
  };

  // === Modal harmonogramu ===
  const openScheduleModal = () => {
    if (selectedDevices.length === 0) {
      setErrorMsg("Wybierz przynajmniej jedno urządzenie.");
      return;
    }
    setIsModalOpen(true);
    setScheduleType("fixed");
    setDateTime(getNowInWarsaw());
    setIsFixedPickerOpen(false);
    setIsWeeklyTimeOpen(false);
    setDayOfWeek(1);
    setHour(8);
    setMinute(0);
    setSelectedGalleryFile(null);
    setActiveTab("gallery");
    if (currentLocationId) fetchGalleryFiles(currentLocationId);
  };

  const closeScheduleModal = () => {
    setIsModalOpen(false);
    setSelectedGalleryFile(null);
    setErrorMsg(null);
  };

  const getFileType = (filename) => {
    if (!filename) return "unknown";
    const ext = filename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "image";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
    return "unknown";
  };

  const handleGalleryFileSelect = (filename) => {
    setSelectedGalleryFile(filename);
    setErrorMsg(null);
  };

  const handleSaveSchedule = async () => {
    if (!currentLocationId) {
      setErrorMsg("Brak wybranej lokalizacji.");
      return;
    }
    if (selectedDevices.length === 0) {
      setErrorMsg("Wybierz urządzenia.");
      return;
    }
    if (!selectedGalleryFile) {
      setErrorMsg("Wybierz plik z galerii.");
      return;
    }
    if (scheduleType === "fixed" && !dateTime) {
      setErrorMsg("Wybierz datę i godzinę dla harmonogramu.");
      return;
    }

    const mediaType = getFileType(selectedGalleryFile);
    if (mediaType === "unknown") {
      setErrorMsg("Wybrany plik nie jest zdjęciem ani filmem.");
      return;
    }

    const media = {
      filename: selectedGalleryFile,
      mediaType: mediaType,
    };

    const scheduleData =
      scheduleType === "fixed"
        ? { type: "fixed", media, date: dateTime?.toISOString() }
        : { type: "weekly", media, dayOfWeek: parseInt(dayOfWeek), hour: parseInt(hour), minute: parseInt(minute) };

    try {
      const promises = selectedDevices.map((device) =>
        fetch(`${API_BASE_URL}/${currentLocationId}/devices/${device._id}/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scheduleData),
        })
      );

      const results = await Promise.all(promises);
      const errors = results.filter((res) => !res.ok);

      if (errors.length > 0) {
        const errorMessages = await Promise.all(
          errors.map(async (res) => {
            try {
              const errData = await res.json();
              return errData.detail || errData.message || "Nieznany błąd";
            } catch {
              return "Nieznany błąd";
            }
          })
        );
        throw new Error(`Błędy podczas zapisywania harmonogramów: ${errorMessages.join(", ")}`);
      }

      setErrorMsg(null);
      setIsModalOpen(false);
      setSelectedGalleryFile(null);
    } catch (err) {
      console.error("Błąd zapisywania harmonogramów:", err);
      setErrorMsg(err.message);
    }
  };

  // === Listowanie/Usuwanie istniejących harmonogramów jednego urządzenia ===
  const fetchDeviceSchedules = async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${currentLocationId}/devices/${deviceId}/schedules`);
      if (!res.ok) throw new Error("Błąd pobierania harmonogramów");
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`Błąd pobierania harmonogramów dla urządzenia ${deviceId}:`, err);
      return [];
    }
  };

  const handleShowSchedules = async () => {
    if (selectedDevices.length !== 1) {
      setErrorMsg("Wybierz dokładnie jedno urządzenie, aby zobaczyć jego harmonogramy.");
      return;
    }
    try {
      const schedules = await fetchDeviceSchedules(selectedDevices[0]._id);
      setExistingSchedules(schedules);
      setIsScheduleListOpen(true);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!selectedDevices.length) return;
    try {
      const deviceId = selectedDevices[0]._id;
      const res = await fetch(`${API_BASE_URL}/${currentLocationId}/devices/${deviceId}/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Błąd usuwania harmonogramu");
      const updatedSchedules = await fetchDeviceSchedules(deviceId);
      setExistingSchedules(updatedSchedules);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // === Pomocnicze do renderu ===
  const getDevicesInGroup = (groupId) => {
    return groupId === null
      ? devices.filter((d) => (d.groups || []).length === 0)
      : devices.filter((d) => (d.groups || []).includes(groupId));
  };

  const getDevicesWithoutGroup = () => devices.filter((d) => (d.groups || []).length === 0);

  const formatScheduleDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    // opcjonalnie można dodać { timeZone: "Europe/Warsaw" } po stronie backendu zapisywać UTC
  };

  const formatWeeklySchedule = (schedule) => {
    const days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
    return `${days[schedule.dayOfWeek]}, ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
  };

  // === RENDER ===
  return (
    <>
      <Navbar />
      <div className={styles.container}>
        {/* Switcher lokalizacji */}
        <div style={{ marginBottom: 12 }}>
          <strong>Wybierz lokalizację: </strong>
          {locationIds.map((locId) => (
            <button
              key={locId}
              onClick={() => handleSwitchLocation(locId)}
              style={{
                marginRight: 8,
                padding: "6px 10px",
                border: "1px solid #ccc",
                background: currentLocationId === locId ? "#e8f0fe" : "white",
                cursor: "pointer",
              }}
              title={locId}
            >
              {locId}
            </button>
          ))}
        </div>

        <div className={styles.header}>
          <h2 className={styles.title}>
            Zarządzanie harmonogramami wyświetlania {currentLocationId ? `– ${currentLocationId}` : ""}
          </h2>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
        </div>

        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group._id} className={styles.groupSection}>
              <div className={styles.groupHeader}>
                <h3 className={styles.groupName}>
                  {group.name} ({getDevicesInGroup(group._id).length} urządzeń)
                </h3>
                <div className={styles.groupActions}>
                  <button className={styles.selectGroupButton} onClick={() => handleGroupSelectAllToggle(group._id)}>
                    {getDevicesInGroup(group._id).every((d) => selectedDevices.some((s) => s._id === d._id))
                      ? "Odznacz wszystkie w grupie"
                      : "Zaznacz wszystkie w grupie"}
                  </button>
                </div>
              </div>

              {getDevicesInGroup(group._id).length > 0 ? (
                <div className={styles.deviceGrid}>
                  {getDevicesInGroup(group._id).map((device) => (
                    <div
                      key={device._id}
                      className={`${styles.deviceCard} ${device.isOnline ? "" : styles.offline} ${
                        selectedDevices.some((d) => d._id === device._id) ? styles.selected : ""
                      }`}
                      onClick={() => device.isOnline && handleDeviceSelectToggle(device)}
                    >
                      <div className={styles.deviceIcons}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(device);
                          }}
                          className={styles.editButton}
                        >
                          <img src={editIcon} alt="Edytuj" className={styles.editIcon} />
                        </button>
                      </div>

                      <div className={styles.deviceImageContainer}>
                        <div className={styles.hangingWrapper}>
                          <div className={styles.hangerBar}></div>
                          <div className={`${styles.stick} ${styles.left}`}></div>
                          <div className={`${styles.stick} ${styles.right}`}></div>
                          {getFileType(device.thumbnail || "") === "video" ? (
                            <video
                              src={
                                device.thumbnail
                                  ? `${API_BASE_URL}/${currentLocationId}/files/${device.thumbnail}`
                                  : null
                              }
                              autoPlay
                              loop
                              muted
                              className={styles.deviceImage}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/src/assets/images/device.png";
                              }}
                            />
                          ) : (
                            <img
                              src={
                                device.thumbnail
                                  ? `${API_BASE_URL}/${currentLocationId}/files/${device.thumbnail}`
                                  : "/src/assets/images/device.png"
                              }
                              alt="Device"
                              className={styles.deviceImage}
                            />
                          )}
                        </div>
                        <div
                          className={`${styles.onlineIndicator} ${device.isOnline ? styles.green : styles.red}`}
                          title={device.isOnline ? "Online" : "Offline"}
                        ></div>
                      </div>

                      <div className={styles.deviceInfo}>
                        {editingDeviceId === device._id ? (
                          <>
                            <input
                              type="text"
                              value={editInputValue}
                              onChange={(e) => setEditInputValue(e.target.value)}
                              className={styles.editInput}
                            />
                            <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>
                              Zapisz
                            </button>
                            <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>
                              Resetuj
                            </button>
                            <button onClick={handleEditCancel} className={styles.cancelButton}>
                              Anuluj
                            </button>
                          </>
                        ) : (
                          <div className={styles.deviceNameEditWrapper}>
                            <h3 className={styles.deviceName}>{getDisplayName(device.clientName)}</h3>
                          </div>
                        )}
                        <p className={styles.deviceId}>Client: {device.clientId}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noDevicesMessage}>Brak urządzeń w tej grupie.</p>
              )}
            </div>
          ))
        ) : (
          <p className={styles.noGroupsMessage}>Brak zdefiniowanych grup dla tej lokalizacji.</p>
        )}

        {/* Urządzenia bez grup */}
        <div className={styles.groupSection}>
          <div className={styles.groupHeader}>
            <h3 className={styles.groupName}>
              Urządzenia bez grup ({getDevicesInGroup(null).length} urządzeń)
            </h3>
            <button className={styles.selectGroupButton} onClick={() => handleGroupSelectAllToggle(null)}>
              {getDevicesInGroup(null).every((d) => selectedDevices.some((s) => s._id === d._id))
                ? "Odznacz wszystkie bez grupy"
                : "Zaznacz wszystkie bez grupy"}
            </button>
          </div>

          {getDevicesInGroup(null).length > 0 ? (
            <div className={styles.deviceGrid}>
              {getDevicesInGroup(null).map((device) => (
                <div
                  key={device._id}
                  className={`${styles.deviceCard} ${device.isOnline ? "" : styles.offline} ${
                    selectedDevices.some((d) => d._id === device._id) ? styles.selected : ""
                  }`}
                  onClick={() => device.isOnline && handleDeviceSelectToggle(device)}
                >
                  <div className={styles.deviceIcons}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(device);
                      }}
                      className={styles.editButton}
                    >
                      <img src={editIcon} alt="Edytuj" className={styles.editIcon} />
                    </button>
                  </div>

                  <div className={styles.deviceImageContainer}>
                    <div className={styles.hangingWrapper}>
                      <div className={styles.hangerBar}></div>
                      <div className={`${styles.stick} ${styles.left}`}></div>
                      <div className={`${styles.stick} ${styles.right}`}></div>
                      {getFileType(device.thumbnail || "") === "video" ? (
                        <video
                          src={
                            device.thumbnail
                              ? `${API_BASE_URL}/${currentLocationId}/files/${device.thumbnail}`
                              : null
                          }
                          autoPlay
                          loop
                          muted
                          className={styles.deviceImage}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/src/assets/images/device.png";
                          }}
                        />
                      ) : (
                        <img
                          src={
                            device.thumbnail
                              ? `${API_BASE_URL}/${currentLocationId}/files/${device.thumbnail}`
                              : "/src/assets/images/device.png"
                          }
                          alt="Device"
                          className={styles.deviceImage}
                        />
                      )}
                    </div>
                    <div
                      className={`${styles.onlineIndicator} ${device.isOnline ? styles.green : styles.red}`}
                      title={device.isOnline ? "Online" : "Offline"}
                    ></div>
                  </div>

                  <div className={styles.deviceInfo}>
                    {editingDeviceId === device._id ? (
                      <>
                        <input
                          type="text"
                          value={editInputValue}
                          onChange={(e) => setEditInputValue(e.target.value)}
                          className={styles.editInput}
                        />
                        <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>
                          Zapisz
                        </button>
                        <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>
                          Resetuj
                        </button>
                        <button onClick={handleEditCancel} className={styles.cancelButton}>
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <h3 className={styles.deviceName}>{getDisplayName(device.clientName)}</h3>
                    )}
                    <p className={styles.deviceId}>
                      Status: <span style={{ color: "green", fontWeight: "bold" }}>Online</span>, {device.clientId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noDevicesMessage}>Brak urządzeń bez przypisanych grup.</p>
          )}
        </div>

        {selectedDevices.length > 0 && (
          <div className={styles.manageButtonContainer}>
            <button className={styles.manageButton} onClick={openScheduleModal}>
              Dodaj harmonogram dla {selectedDevices.length} urządzeń
            </button>
            <button className={styles.showScheduleButton} onClick={handleShowSchedules} disabled={selectedDevices.length !== 1}>
              Pokaż harmonogramy wybranego urządzenia
            </button>
          </div>
        )}

        {isModalOpen && (
          <div className={styles.scheduleModal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Dodaj nowy harmonogram dla {selectedDevices.length} urządzeń</h3>
                <button className={styles.closeButton} onClick={closeScheduleModal}>
                  ×
                </button>
              </div>

              <div className={styles.scheduleTypeSelector}>
                <label className={styles.scheduleTypeLabel}>
                  <input
                    type="radio"
                    name="scheduleType"
                    value="fixed"
                    checked={scheduleType === "fixed"}
                    onChange={() => setScheduleType("fixed")}
                  />
                  <span>Pojedynczy termin</span>
                </label>
                <label className={styles.scheduleTypeLabel}>
                  <input
                    type="radio"
                    name="scheduleType"
                    value="weekly"
                    checked={scheduleType === "weekly"}
                    onChange={() => setScheduleType("weekly")}
                  />
                  <span>Cykliczny (tygodniowy)</span>
                </label>
              </div>

              {scheduleType === "fixed" ? (
                <div className={styles.dateTimePicker}>
                  <label>
                    Data i godzina:
                    <DatePicker
                      selected={dateTime || getNowInWarsaw()}
                      onChange={(next) => {
                        if (!next) return;
                        const prev = dateTime || getNowInWarsaw();
                        const prevHM = prev.getHours() * 60 + prev.getMinutes();
                        const nextHM = next.getHours() * 60 + next.getMinutes();
                        setDateTime(next);
                        if (nextHM !== prevHM) {
                          setIsFixedPickerOpen(false);
                        }
                      }}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={5}
                      dateFormat="Pp"
                      timeCaption="Godzina"
                      locale="pl"
                      className={styles.dateTimeInput}
                      open={isFixedPickerOpen}
                      onInputClick={() => setIsFixedPickerOpen(true)}
                      onClickOutside={() => setIsFixedPickerOpen(false)}
                      onCalendarClose={() => setIsFixedPickerOpen(false)}
                      shouldCloseOnSelect={false}
                    />
                  </label>
                </div>
              ) : (
                <div className={styles.weeklyControls}>
                  <div className={styles.weeklyControl}>
                    <label>
                      Dzień tygodnia:
                      <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={styles.daySelect}>
                        <option value="0">Niedziela</option>
                        <option value="1">Poniedziałek</option>
                        <option value="2">Wtorek</option>
                        <option value="3">Środa</option>
                        <option value="4">Czwartek</option>
                        <option value="5">Piątek</option>
                        <option value="6">Sobota</option>
                      </select>
                    </label>
                  </div>
                  <div className={styles.weeklyControl}>
                    <label>
                      Godzina:
                      <DatePicker
                        selected={new Date(0, 0, 0, hour, minute)}
                        onChange={(time) => {
                          if (!time) return;
                          setHour(time.getHours());
                          setMinute(time.getMinutes());
                          setIsWeeklyTimeOpen(false);
                        }}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={5}
                        timeCaption="Godzina"
                        dateFormat="HH:mm"
                        locale="pl"
                        className={styles.dateTimeInput}
                        open={isWeeklyTimeOpen}
                        onInputClick={() => setIsWeeklyTimeOpen(true)}
                        onClickOutside={() => setIsWeeklyTimeOpen(false)}
                        onCalendarClose={() => setIsWeeklyTimeOpen(false)}
                        shouldCloseOnSelect
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className={styles.tabSwitcher}>
                <button
                  className={`${styles.tab} ${activeTab === "gallery" ? styles.activeTab : ""}`}
                  onClick={() => {
                    setActiveTab("gallery");
                    setSelectedGalleryFile(null);
                    if (currentLocationId) fetchGalleryFiles(currentLocationId);
                  }}
                >
                  Galeria plików
                </button>
              </div>

              {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

              {activeTab === "gallery" ? (
                <div className={styles.galleryContainer}>
                  {galleryFiles.length > 0 ? (
                    <div className={styles.fileGrid}>
                      {galleryFiles.map((filename) => {
                        const fileType = getFileType(filename);
                        const fileUrl = `${API_BASE_URL}/${currentLocationId}/files/${filename}`;
                        return (
                          <label
                            key={filename}
                            className={`${styles.galleryItem} ${selectedGalleryFile === filename ? styles.selectedGalleryItem : ""}`}
                          >
                            <input
                              type="radio"
                              name="galleryFile"
                              value={filename}
                              checked={selectedGalleryFile === filename}
                              onChange={() => handleGalleryFileSelect(filename)}
                              className={styles.galleryRadioButton}
                            />
                            <div className={styles.galleryMediaWrapper}>
                              {fileType === "image" ? (
                                <img src={fileUrl} alt={filename} className={styles.galleryMedia} />
                              ) : fileType === "video" ? (
                                <video
                                  src={fileUrl}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className={styles.galleryMedia}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/src/assets/images/placeholder-video.png";
                                  }}
                                />
                              ) : (
                                <div className={styles.galleryPlaceholder}>
                                  <span className={styles.fileIcon}>📄</span>
                                </div>
                              )}
                            </div>
                            <span className={styles.galleryFileName}>{filename}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p>Brak plików w galerii dla tej lokalizacji.</p>
                  )}
                </div>
              ) : (
                <div className={styles.galleryInfo}>
                  {selectedGalleryFile ? (
                    <div className={styles.selectedFilePreview}>
                      {getFileType(selectedGalleryFile) === "image" ? (
                        <img
                          src={`${API_BASE_URL}/${currentLocationId}/files/${selectedGalleryFile}`}
                          alt="Selected"
                          className={styles.previewImage}
                        />
                      ) : (
                        <video
                          src={`${API_BASE_URL}/${currentLocationId}/files/${selectedGalleryFile}`}
                          controls
                          className={styles.previewImage}
                        />
                      )}
                      <div className={styles.selectedFileInfo}>
                        <p>Wybrany plik: {selectedGalleryFile}</p>
                        <p>Typ: {getFileType(selectedGalleryFile) === "image" ? "Zdjęcie" : "Film"}</p>
                      </div>
                    </div>
                  ) : (
                    <p>Wybierz plik z galerii powyżej.</p>
                  )}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.saveButton}
                  onClick={handleSaveSchedule}
                  disabled={!selectedGalleryFile || (scheduleType === "fixed" && !dateTime)}
                >
                  Zapisz harmonogram
                </button>
                <button className={styles.cancelButton} onClick={closeScheduleModal}>
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

        {isScheduleListOpen && (
          <div className={styles.scheduleListModal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Harmonogramy dla {selectedDevices.length > 0 ? getDisplayName(selectedDevices[0].clientName) : ""}
                </h3>
                <button className={styles.closeButton} onClick={() => setIsScheduleListOpen(false)}>
                  ×
                </button>
              </div>

              {existingSchedules.length > 0 ? (
                <div className={styles.scheduleList}>
                  {existingSchedules.map((schedule) => (
                    <div key={schedule._id} className={styles.scheduleItem}>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.scheduleType}>{schedule.type === "fixed" ? "Pojedynczy" : "Cykliczny"}</div>
                        <div className={styles.scheduleTime}>
                          {schedule.type === "fixed" ? formatScheduleDate(schedule.date) : formatWeeklySchedule(schedule)}
                        </div>
                        <div className={styles.scheduleMedia}>
                          {schedule.media.filename} ({schedule.media.mediaType})
                        </div>
                      </div>
                      <button className={styles.deleteScheduleButton} onClick={() => handleDeleteSchedule(schedule._id)}>
                        Usuń
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Brak harmonogramów dla tego urządzenia.</p>
              )}

              <div className={styles.modalActions}>
                <button className={styles.closeButton} onClick={() => setIsScheduleListOpen(false)}>
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Schedule;
