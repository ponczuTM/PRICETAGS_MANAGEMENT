import React, { useEffect, useRef, useState } from "react";
import styles from "./MainPage.module.css";
import Navbar from "./Navbar";
import Chatbot from "./Chatbot";
import edit from "./../assets/images/edit.png";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/locations`;

function MainPage() {
  const navigate = useNavigate();
  const storedUser = localStorage.getItem("user");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;

  const storedLocationIds = (() => {
    try {
      const arr = JSON.parse(localStorage.getItem("locationIds") || "[]");
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch (_) {}
    const legacy = localStorage.getItem("locationId");
    return legacy ? [legacy] : (parsedUser?.locationIds || []);
  })();

  const [locationIds, setLocationIds] = useState(storedLocationIds);
  const [currentLocationId, setCurrentLocationId] = useState(() => {
    // weź ostatnio wybraną (legacy) albo pierwszą z listy
    const legacy = localStorage.getItem("locationId");
    return legacy || (storedLocationIds.length > 0 ? storedLocationIds[0] : null);
  });

  // === RESZTA STANÓW ===
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [activeTab, setActiveTab] = useState("photo");
  const [errorMsg, setErrorMsg] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [selectedGalleryFile, setSelectedGalleryFile] = useState(null);
  const [uploadStatuses, setUploadStatuses] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const videoRef = useRef(null);

  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editedNames, setEditedNames] = useState(() => {
    const stored = localStorage.getItem("deviceNames");
    return stored ? JSON.parse(stored) : {};
  });
  const [editInputValue, setEditInputValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");

  useEffect(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach((v) => {
      v.muted = true;
      v.volume = 0;
    });
  }, [selectedDevices]);
  

  // === GUARD: brak użytkownika albo brak lokalizacji -> do logowania ===
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
    // gdy nie ma currentLocationId (np. pierwszy raz) – ustaw pierwszy
    if (!currentLocationId) {
      setCurrentLocationId(locationIds[0]);
      localStorage.setItem("locationId", locationIds[0]); // legacy zgodność
    }
  }, [parsedUser, locationIds, currentLocationId, navigate]);

  // === przełączanie nazwy wyświetlanej urządzenia ===
  const getDisplayName = (clientName) => editedNames[clientName] || clientName;

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

  // === POBIERANIE DANYCH – teraz reaguje na zmianę currentLocationId ===
  useEffect(() => {
    if (!currentLocationId) return;
    fetchDevices(currentLocationId);
    // jeżeli aktywna karta to 'gallery', dociągnij galerie dla tej lokalizacji
    if (activeTab === "gallery") {
      fetchGalleryFiles(currentLocationId);
    }
    // wyczyść wybory przy zmianie lokalizacji
    setSelectedDevices([]);
    setUploadStatuses({});
    setErrorMsg(null);
  }, [currentLocationId]);

  useEffect(() => {
    if (selectedDevices.length > 0 && activeTab === "gallery" && currentLocationId) {
      fetchGalleryFiles(currentLocationId);
    }
  }, [selectedDevices, activeTab, currentLocationId]);

  const fetchDevices = async (locId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locId}/devices`);
      if (!res.ok) throw new Error("Błąd pobierania urządzeń");
      const devicesData = await res.json();
      setDevices(devicesData);

      const filesInfo = {};
      for (const device of devicesData) {
        filesInfo[device._id] = {
          photoUrl: device.photo ? `${API_BASE_URL}/${locId}/files/${device.photo}` : null,
          videoUrl: device.video ? `${API_BASE_URL}/${locId}/files/${device.video}` : null,
        };
      }
      setUploadedFiles(filesInfo);
    } catch (err) {
      console.error("Błąd pobierania urządzeń:", err);
      setErrorMsg("Nie udało się pobrać urządzeń.");
    }
  };

  const fetchGalleryFiles = async (locId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locId}/files/`);
      if (!res.ok) {
        throw new Error("Błąd podczas pobierania listy plików z galerii");
      }
      const data = await res.json();
      setGalleryFiles(data.files || []);
    } catch (err) {
      console.error("Błąd pobierania plików galerii:", err);
      setErrorMsg("Nie udało się załadować plików galerii.");
    }
  };

  // === SWITCHER LOKALIZACJI (proste przyciski) ===
  const handleSwitchLocation = (locId) => {
    setCurrentLocationId(locId);
    localStorage.setItem("locationId", locId); // legacy zgodność (inne ekrany mogą tego używać)
  };

  // === drag & drop / wybór pliku ===
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (f) => {
    setSelectedGalleryFile(null);

    const isImage = activeTab === "photo" && f.type.startsWith("image/");
    const isVideo = activeTab === "video" && f.type.startsWith("video/");

    if (isImage || isVideo) {
      setFile(f);
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      setErrorMsg(null);
    } else {
      setFile(null);
      setPreviewUrl(null);
      setErrorMsg(
        activeTab === "photo"
          ? "Dozwolone tylko pliki graficzne"
          : "Dozwolone tylko pliki wideo"
      );
    }
  };

  const handleGalleryFileSelect = (filename) => {
    setSelectedGalleryFile(filename);
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
  };

  // === upload masowy ===
  const handleMassUpload = async () => {
    if (!currentLocationId) {
      setErrorMsg("Brak wybranej lokalizacji.");
      return;
    }

    if (selectedDevices.length === 0) {
      setErrorMsg("Wybierz urządzenia, dla których chcesz zaktualizować pliki.");
      return;
    }

    if (!file && !selectedGalleryFile) {
      setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
      return;
    }

    setErrorMsg(null);

    const initialStatuses = {};
    selectedDevices.forEach((device) => {
      initialStatuses[device._id] = { status: "pending", message: "Oczekuje..." };
    });
    setUploadStatuses(initialStatuses);

    let filenameToUse = null;

    // 1) upload nowego pliku
    if (file) {
      setUploadStatuses((prev) => {
        const ns = { ...prev };
        selectedDevices.forEach((device) => {
          ns[device._id] = {
            status: "uploading_file",
            message: `${device.clientName}, ${device.clientId}: Wysyłanie pliku głównego...`,
          };
        });
        return ns;
      });

      const formData = new FormData();
      formData.append("file", file);

      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/${currentLocationId}/upload-file/`, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Błąd podczas przesyłania pliku");
        }

        const uploadResult = await uploadResponse.json();
        filenameToUse = uploadResult.filename;
      } catch (err) {
        console.error("Błąd wysyłania pliku:", err);
        setErrorMsg("Wystąpił błąd podczas przesyłania pliku: " + err.message);
        setUploadStatuses((prev) => {
          const ns = { ...prev };
          selectedDevices.forEach((device) => {
            ns[device._id] = {
              status: "error",
              message: `${device.clientName}, ${device.clientId}: Błąd uploadu pliku: ${err.message}`,
            };
          });
          return ns;
        });
        return;
      }
    } else if (selectedGalleryFile) {
      filenameToUse = selectedGalleryFile;
    } else {
      setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
      return;
    }

    // 2) przypisanie do urządzeń
    if (filenameToUse) {
      const fileTypeActual = getFileType(filenameToUse);
      let fieldToUpdate = null;

      if (fileTypeActual === "image") fieldToUpdate = "photo";
      else if (fileTypeActual === "video") fieldToUpdate = "video";
      else {
        setErrorMsg("Wybrany plik z galerii nie jest zdjęciem ani filmem i nie może zostać przypisany.");
        return;
      }

      for (let i = 0; i < selectedDevices.length; i++) {
        const device = selectedDevices[i];
        setUploadStatuses((prev) => ({
          ...prev,
          [device._id]: { status: "in_progress", message: `${device.clientName}, ${device.clientId}: Aktualizowanie...` },
        }));

        try {
          await fetch(`${API_BASE_URL}/${currentLocationId}/devices/${device._id}/delete-files`, { method: "DELETE" });

          const updateFieldResponse = await fetch(
            `${API_BASE_URL}/${currentLocationId}/devices/${device._id}/${fieldToUpdate}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ [fieldToUpdate]: filenameToUse }),
            }
          );
          if (!updateFieldResponse.ok) throw new Error(`Błąd podczas aktualizacji pola ${fieldToUpdate}`);

          const updateChangedFlagResponse = await fetch(
            `${API_BASE_URL}/${currentLocationId}/devices/${device._id}/changed-true`,
            { method: "PUT" }
          );
          if (!updateChangedFlagResponse.ok) throw new Error("Błąd podczas ustawiania flagi 'changed' na true");

          const updateThumbnailResponse = await fetch(
            `${API_BASE_URL}/${currentLocationId}/devices/${device._id}/thumbnail`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thumbnail: filenameToUse }),
            }
          );
          if (!updateThumbnailResponse.ok) throw new Error("Błąd podczas aktualizacji miniaturki urządzenia");

          setUploadStatuses((prev) => ({
            ...prev,
            [device._id]: { status: "success", message: `${device.clientName}, ${device.clientId}: Zakończono sukcesem` },
          }));
        } catch (err) {
          console.error(`Błąd podczas aktualizacji urządzenia ${device.clientName}:`, err);
          setUploadStatuses((prev) => ({
            ...prev,
            [device._id]: { status: "error", message: `${device.clientName}, ${device.clientId}: Błąd: ${err.message}` },
          }));
        }
      }

      // odśwież listę urządzeń
      fetchDevices(currentLocationId);
      setIsModalOpen(false);
      setSelectedDevices([]);
      setFile(null);
      setPreviewUrl(null);
      setSelectedGalleryFile(null);
      setUploadStatuses({});
    }
  };

  const closeUpload = () => {
    setSelectedDevices([]);
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setActiveTab("photo");
    setGalleryFiles([]);
    setSelectedGalleryFile(null);
    setUploadStatuses({});
    setIsModalOpen(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileType = (filename) => {
    const ext = (filename || "").split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "image";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
    return "unknown";
  };

  const handleDeviceSelectToggle = (device) => {
    setSelectedDevices((prevSelected) => {
      const newSelected = prevSelected.some((d) => d._id === device._id)
        ? prevSelected.filter((d) => d._id !== device._id)
        : [...prevSelected, device];
      setUploadStatuses({});
      return newSelected;
    });
    setErrorMsg(null);
  };

  const handleSelectAllToggle = () => {
    const onlineDevices = devices.filter((device) => device.isOnline);
    if (selectedDevices.length === onlineDevices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(onlineDevices);
    }
    setUploadStatuses({});
    setErrorMsg(null);
  };

  return (
    <>
      <Navbar />
      <Chatbot/>
      <div className={styles.container}>
        {/* === SWITCHER LOKALIZACJI (proste przyciski nad wszystkim) === */}
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
        {/* <h2 className={styles.title}>
          Lista urządzeń {currentLocationId ? `– ${locations.find(l => l.id === currentLocationId)?.name || ""}` : ""}
        </h2> */}

          <div className={styles.deviceCount}>{devices.length} urządzeń</div>
        </div>

        <div className={styles.selectAllContainer}>
          <button className={styles.selectButton} onClick={handleSelectAllToggle}>
            {selectedDevices.length === devices.filter((d) => d.isOnline).length
              ? "Odznacz wszystkie (ONLINE)"
              : "Zaznacz wszystkie (ONLINE)"}
          </button>
        </div>

        <div className={styles.deviceGrid}>
          {devices.map((device) => (
            <div
              key={device._id}
              className={`${styles.deviceCard} ${
                selectedDevices.some((d) => d._id === device._id) ? styles.selected : ""
              } ${!device.isOnline ? styles.offline : ""}`}
              onClick={() => {
                if (device.isOnline) {
                  handleDeviceSelectToggle(device);
                }
              }}
            >
              <div className={styles.deviceImageContainer}>
                <div className={styles.hangingWrapper}>
                  <div className={styles.hangerBar}></div>
                  <div className={styles.stick + " " + styles.left}></div>
                  <div className={styles.stick + " " + styles.right}></div>
                  {getFileType(device.thumbnail || "") === "video" ? (
                    <video
                      src={
                        device.thumbnail
                          ? `${API_BASE_URL}/${currentLocationId}/files/${device.thumbnail}`
                          : null
                      }
                      autoPlay
                      loop
                      muted={true}
                      volume={0}
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
                  className={`${styles.onlineIndicator} ${
                    device.isOnline ? styles.green : styles.red
                  }`}
                  title={device.isOnline ? "Online" : "Offline"}
                ></div>
              </div>

              <div className={styles.deviceInfo}>
                <div className={styles.deviceNameEditWrapper}>
                  {editingDeviceId === device._id ? (
                    <>
                      <input
                        type="text"
                        value={editInputValue}
                        onChange={(e) => setEditInputValue(e.target.value)}
                        className={styles.editInput}
                      />
                      <button
                        onClick={() => handleEditSave(device.clientName)}
                        className={styles.saveButton}
                      >
                        Zapisz
                      </button>
                      <button
                        onClick={() => handleEditReset(device.clientName)}
                        className={styles.resetButton}
                      >
                        Resetuj
                      </button>
                      <button onClick={handleEditCancel} className={styles.cancelButton}>
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className={styles.deviceName}>{getDisplayName(device.clientName)}</h3>
                      <button
                        onClick={() => handleEditClick(device)}
                        className={styles.editButton}
                      >
                        <img src={edit} alt="Edytuj" className={styles.editIcon} />
                      </button>
                    </>
                  )}
                </div>

                <p className={styles.deviceId}>Client: {device.clientId}</p>
                <p className={styles.deviceId}>IP: {device.ip}</p>
              </div>
            </div>
          ))}
        </div>

        {selectedDevices.length > 0 && (
          <div className={styles.manageButtonContainer}>
            <button className={styles.manageButton} onClick={() => setIsModalOpen(true)}>
              Zarządzaj urządzeniami ({selectedDevices.length})
            </button>
          </div>
        )}

        {isModalOpen && (
          <div className={styles.uploadModal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Załaduj {activeTab === "photo" ? "zdjęcie" : activeTab === "video" ? "film" : "plik"} dla
                  wybranych urządzeń
                </h3>
                <button className={styles.closeButton} onClick={closeUpload}>
                  ×
                </button>
              </div>

              <div className={styles.tabSwitcher}>
                <button
                  className={`${styles.tab} ${activeTab === "photo" ? styles.activeTab : ""}`}
                  onClick={() => {
                    setActiveTab("photo");
                    setFile(null);
                    setPreviewUrl(null);
                    setSelectedGalleryFile(null);
                  }}
                >
                  Zdjęcie
                </button>
                <button
                  className={`${styles.tab} ${activeTab === "video" ? styles.activeTab : ""}`}
                  onClick={() => {
                    setActiveTab("video");
                    setFile(null);
                    setPreviewUrl(null);
                    setSelectedGalleryFile(null);
                  }}
                >
                  Film
                </button>
                <button
                  className={`${styles.tab} ${activeTab === "gallery" ? styles.activeTab : ""}`}
                  onClick={() => {
                    setActiveTab("gallery");
                    setFile(null);
                    setPreviewUrl(null);
                    if (currentLocationId) fetchGalleryFiles(currentLocationId);
                  }}
                >
                  Galeria plików
                </button>
              </div>

              {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

              {Object.keys(uploadStatuses).length > 0 && (
                <div className={styles.uploadStatusContainer}>
                  <h4>Statusy operacji:</h4>
                  <ul className={styles.uploadStatusList}>
                    {selectedDevices.map((device) => (
                      <li
                        key={device._id}
                        className={`${styles.modalUploadStatusItem} ${
                          styles[uploadStatuses[device._id]?.status || "pending"]
                        }`}
                      >
                        <span className={styles.deviceNameInStatus}>
                          {getDisplayName(device.clientName)}, {device.clientId}:
                        </span>{" "}
                        {uploadStatuses[device._id]?.message || "Oczekuje..."}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab !== "gallery" ? (
                <div
                  className={`${styles.dropZone} ${file ? styles.hasFile : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {previewUrl ? (
                    <div className={styles.previewContainer}>
                      {activeTab === "photo" ? (
                        <img src={previewUrl} alt="Preview" className={styles.previewImage} />
                      ) : (
                        <video src={previewUrl} controls ref={videoRef} className={styles.previewImage} muted={true} volume={0}/>
                      )}
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{file?.name}</span>
                        <span className={styles.fileSize}>
                          {file ? formatFileSize(file.size) : ""}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.dropZoneContent}>
                      <div className={styles.uploadIcon}>📁</div>
                      <p className={styles.dropText}>
                        Przeciągnij i upuść plik {activeTab === "photo" ? "graficzny" : "wideo"} tutaj
                      </p>
                      <p className={styles.dropText}>
                        lub
                      </p>
                      <p className={styles.dropText}>
                        kliknij i wybierz plik
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept={activeTab === "photo" ? "image/*" : "video/*"}
                    onChange={(e) => e.target.files.length > 0 && handleFile(e.target.files[0])}
                    className={styles.fileInput}
                  />
                </div>
              ) : (
                <div className={styles.galleryContainer}>
                  {galleryFiles.length > 0 ? (
                    <div className={styles.fileGrid}>
                      {galleryFiles.map((filename) => {
                        const fileType = getFileType(filename);
                        const fileUrl = `${API_BASE_URL}/${currentLocationId}/files/${filename}`;
                        return (
                          <label
                            key={filename}
                            className={`${styles.galleryItem} ${
                              selectedGalleryFile === filename ? styles.selectedGalleryItem : ""
                            }`}
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
                                  muted={true}
                                  volume={0}
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
                            <span className={styles.galleryFileName}>
                              {filename} {fileType === "image" && "(zdjęcie)"} {fileType === "video" && "(film)"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p>Brak plików w galerii dla tej lokalizacji.</p>
                  )}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.uploadButton}
                  onClick={handleMassUpload}
                  disabled={!(file || selectedGalleryFile) || selectedDevices.length === 0}
                >
                  {activeTab === "gallery" ? "Wybierz plik" : "Wyślij plik"} dla {selectedDevices.length} urządzeń
                </button>
                <button className={styles.cancelButton} onClick={closeUpload}>
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default MainPage;
