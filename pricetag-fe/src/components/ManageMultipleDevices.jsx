import React, { useEffect, useState, useRef } from "react";
import styles from "./ManageMultipleDevices.module.css";

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

// Funkcja pomocnicza do opóźnienia
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ManageMultipleDevices() {
  const [devices, setDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState(new Set()); // Zmienione na Set do przechowywania wielu wybranych urządzeń
  const [file, setFile] = useState(null); // Dla plików przesyłanych
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({}); // Nadal potrzebne do wyświetlania obecnych plików
  const [activeTab, setActiveTab] = useState("photo"); // photo, video, gallery
  const [errorMsg, setErrorMsg] = useState(null);
  const [videoFPS, setVideoFPS] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]); // Stan dla plików w galerii
  const [selectedGalleryFile, setSelectedGalleryFile] = useState(null); // Stan dla wybranego pliku z galerii
  const [isModalOpen, setIsModalOpen] = useState(false); // Nowy stan do zarządzania widocznością modala
  const [isLoading, setIsLoading] = useState(false); // Stan ładowania podczas wysyłki
  const [uploadProgress, setUploadProgress] = useState({}); // Śledzenie postępu dla każdego urządzenia
  const [overallStatus, setOverallStatus] = useState(""); // Ogólny status operacji (np. "Wysyłam pliki...", "Zakończono")


  const videoRef = useRef(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  // Gdy zmienia się activeTab na "gallery", pobierz pliki dla galerii (niezależnie od selectedDevice)
  useEffect(() => {
    if (activeTab === "gallery") {
      fetchGalleryFiles();
    }
  }, [activeTab]);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/devices`);
      const devicesData = await res.json();
      setDevices(devicesData);
      // Pobierz informacje o istniejących plikach dla każdego urządzenia
      const filesInfo = {};
      for (const device of devicesData) {
        filesInfo[device._id] = {
          photoUrl: device.photo ? `${API_BASE_URL}/${locationId}/files/${device.photo}` : null,
          videoUrl: device.video ? `${API_BASE_URL}/${locationId}/files/${device.video}` : null,
        };
      }
      setUploadedFiles(filesInfo);
    } catch (err) {
      console.error("Błąd pobierania urządzeń:", err);
      setErrorMsg("Nie udało się załadować listy urządzeń.");
    }
  };

  const fetchGalleryFiles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/files/`);
      if (!res.ok) {
        throw new Error("Błąd podczas pobierania listy plików z galerii");
      }
      const data = await res.json();
      setGalleryFiles(data.files);
    } catch (err) {
      console.error("Błąd pobierania plików galerii:", err);
      setErrorMsg("Nie udało się załadować plików galerii.");
    }
  };

  const measureVideoFPS = (videoEl) => {
    return new Promise((resolve) => {
      if (!videoEl || typeof videoEl.requestVideoFrameCallback !== "function") {
        resolve("Brak wsparcia FPS");
        return;
      }
      try {
        let frames = 0;
        let start = performance.now();
        const countFrames = () => {
          frames++;
          const now = performance.now();
          const duration = now - start;
          if (duration >= 1000) {
            const fps = (frames / (duration / 1000)).toFixed(2);
            videoEl.pause();
            resolve(fps);
          } else {
            videoEl.requestVideoFrameCallback(countFrames);
          }
        };
        videoEl.currentTime = 0.1;
        const onError = () => {
          resolve("Błąd przetwarzania");
        };
        videoEl.onerror = onError;
        videoEl.play()
          .then(() => {
            videoEl.requestVideoFrameCallback(countFrames);
          })
          .catch(() => {
            resolve("Błąd przetwarzania");
          });
      } catch (e) {
        resolve("Błąd przetwarzania");
      }
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (f) => {
    setSelectedGalleryFile(null); // Resetuj wybrany plik z galerii
    const isImage = activeTab === "photo" && f.type.startsWith("image/");
    const isVideo = activeTab === "video" && f.type.startsWith("video/");

    if (isImage || isVideo) {
      setFile(f);
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      setErrorMsg(null);
      setVideoFPS(null);
      if (isVideo) {
        setTimeout(() => {
          if (videoRef.current) {
            measureVideoFPS(videoRef.current).then(setVideoFPS);
          }
        }, 500);
      }
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
    setFile(null); // Resetuj plik do uploadu
    setPreviewUrl(null);
    setErrorMsg(null);
    setVideoFPS(null);
  };

  const handleDeviceSelect = (deviceId) => {
    setSelectedDevices((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(deviceId)) {
        newSelected.delete(deviceId);
      } else {
        newSelected.add(deviceId);
      }
      return newSelected;
    });
  };

  const openUploadModal = () => {
    if (selectedDevices.size === 0) {
      setErrorMsg("Wybierz co najmniej jedno urządzenie.");
      return;
    }
    setIsModalOpen(true);
    setErrorMsg(null);
    setFile(null);
    setPreviewUrl(null);
    setSelectedGalleryFile(null);
    setVideoFPS(null);
    setActiveTab("photo"); // Domyślna zakładka po otwarciu modala
    setUploadProgress({}); // Resetuj postęp przy otwieraniu modala
    setOverallStatus("");
  };

  const handleMultiUpload = async () => {
    if (selectedDevices.size === 0) {
      setErrorMsg("Nie wybrano żadnego urządzenia.");
      return;
    }
    if (!file && !selectedGalleryFile) {
      setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setUploadProgress({}); // Resetuj postęp
    setOverallStatus("Przygotowuję pliki...");

    let filenameToUse = null;

    if (selectedGalleryFile) {
      // Przypadek 1: Plik wybrany z galerii
      filenameToUse = selectedGalleryFile;
    } else if (file) {
      // Przypadek 2: Plik przeciągnięty/wybrany do uploadu
      setOverallStatus("Przesyłam plik na serwer...");
      const formData = new FormData();
      formData.append("file", file);
      try {
        const uploadResponse = await fetch(
          `${API_BASE_URL}/${locationId}/upload-file/`,
          {
            method: "POST",
            body: formData,
          }
        );
        if (!uploadResponse.ok) {
          throw new Error("Błąd podczas przesyłania pliku");
        }
        const uploadResult = await uploadResponse.json();
        filenameToUse = uploadResult.filename;
      } catch (err) {
        console.error("Błąd wysyłania pliku:", err);
        setErrorMsg("Wystąpił błąd podczas przesyłania pliku: " + err.message);
        setIsLoading(false);
        setOverallStatus("Błąd");
        return;
      }
    }

    if (!filenameToUse) {
      setErrorMsg("Brak nazwy pliku do użycia.");
      setIsLoading(false);
      setOverallStatus("Błąd");
      return;
    }

    const fileTypeActual = getFileType(filenameToUse);
    let fieldToUpdate = null;
    if (fileTypeActual === 'image') {
      fieldToUpdate = 'photo';
    } else if (fileTypeActual === 'video') {
      fieldToUpdate = 'video';
    } else {
      setErrorMsg("Wybrany plik nie jest zdjęciem ani filmem i nie może zostać przypisany.");
      setIsLoading(false);
      setOverallStatus("Błąd");
      return;
    }

    const deviceIds = Array.from(selectedDevices);
    let allSucceeded = true;

    for (const deviceId of deviceIds) {
      const device = devices.find(d => d._id === deviceId);
      const deviceName = device ? device.clientName : deviceId;

      setUploadProgress((prev) => ({
        ...prev,
        [deviceId]: "Oczekuje...",
      }));
      setOverallStatus(`Aktualizuję ${deviceName}...`);

      try {
        await delay(1000); // 1 sekunda opóźnienia między requestami

        setUploadProgress((prev) => ({
          ...prev,
          [deviceId]: "Wysyłam...",
        }));

        // 1. Aktualizacja pola 'photo' lub 'video'
        const updateFieldResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${deviceId}/${fieldToUpdate}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [fieldToUpdate]: filenameToUse }),
          }
        );
        if (!updateFieldResponse.ok) {
          throw new Error(`Błąd aktualizacji pola ${fieldToUpdate}`);
        }

        // 2. Ustawienie flagi 'changed' na true
        const updateChangedFlagResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${deviceId}/changed-true`,
          { method: "PUT" }
        );
        if (!updateChangedFlagResponse.ok) {
          throw new Error("Błąd ustawiania flagi 'changed'");
        }

        // 3. Ustawienie miniaturki (thumbnail)
        const updateThumbnailResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${deviceId}/thumbnail`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              thumbnail: `${filenameToUse.split(".")[0]}.png`,
            }),
          }
        );
        if (!updateThumbnailResponse.ok) {
          throw new Error("Błąd aktualizacji miniaturki");
        }

        setUploadProgress((prev) => ({
          ...prev,
          [deviceId]: "Sukces",
        }));
      } catch (err) {
        console.error(`Błąd aktualizacji urządzenia ${deviceId}:`, err);
        setUploadProgress((prev) => ({
          ...prev,
          [deviceId]: `Błąd: ${err.message}`,
        }));
        allSucceeded = false; // Ustaw flagę, że były błędy
      }
    }

    setIsLoading(false);
    if (allSucceeded) {
      setOverallStatus("Wszystkie urządzenia zaktualizowane pomyślnie!");
      closeUploadModal(); // Zamknij modal tylko, gdy wszystko poszło gładko
      fetchDevices(); // Odśwież listę urządzeń po zakończeniu wszystkich operacji
      setSelectedDevices(new Set()); // Wyczyść wybrane urządzenia po udanym uploadzie
    } else {
      setOverallStatus("Zakończono z błędami.");
      setErrorMsg("Wystąpiły błędy podczas aktualizacji niektórych urządzeń. Sprawdź szczegóły poniżej.");
      fetchDevices(); // Odśwież urządzenia, nawet jeśli były błędy
    }
  };


  const handleDeleteFile = async (deviceId, fileType) => {
    try {
      // Wyczyść pole w urządzeniu
      const updateResponse = await fetch(
        `${API_BASE_URL}/${locationId}/devices/${deviceId}/${fileType}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [fileType]: "" }),
        }
      );
      if (!updateResponse.ok) {
        throw new Error("Błąd podczas usuwania pliku");
      }
      // Oznacz urządzenie jako zmienione
      await fetch(
        `${API_BASE_URL}/${locationId}/devices/${deviceId}/changed-true`,
        {
          method: "PUT",
        }
      );
      // Zaktualizuj stan
      setUploadedFiles((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          [`${fileType}Url`]: null,
        },
      }));
      fetchDevices(); // Odśwież listę urządzeń
    } catch (err) {
      console.error("Błąd usuwania pliku:", err);
      setErrorMsg("Wystąpił błąd podczas usuwania pliku");
    }
  };

  const closeUploadModal = () => {
    setIsModalOpen(false);
    setSelectedDevices(new Set()); // Wyczyść wybrane urządzenia po zamknięciu modala
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setActiveTab("photo");
    setVideoFPS(null);
    setGalleryFiles([]); // Wyczyść pliki galerii przy zamknięciu
    setSelectedGalleryFile(null); // Wyczyść wybrany plik galerii
    setUploadProgress({}); // Wyczyść postęp
    setOverallStatus("");
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'video';
    }
    return 'unknown';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Zarządzaj wieloma urządzeniami</h2>
        <div className={styles.deviceCount}>{devices.length} urządzeń</div>
      </div>
      <div className={styles.deviceGrid}>
        {devices.map((device) => (
          <div
            key={device._id}
            className={`${styles.deviceCard} ${
              selectedDevices.has(device._id) ? styles.selected : ""
            }`}
            onClick={() => handleDeviceSelect(device._id)}
          >
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                checked={selectedDevices.has(device._id)}
                onChange={() => handleDeviceSelect(device._id)}
                className={styles.deviceCheckbox}
              />
            </div>
            <div className={styles.deviceImageContainer}>
              <div className={styles.hangingWrapper}>
                <div className={styles.hangerBar}></div>
                <div className={styles.stick + " " + styles.left}></div>
                <div className={styles.stick + " " + styles.right}></div>
                <img
                  src={
                    device.video
                      ? `${API_BASE_URL}/${locationId}/files/${device.video}/thumbnail`
                      : device.photo
                      ? `${API_BASE_URL}/${locationId}/files/${device.photo}/thumbnail`
                      : "/src/assets/images/device.png"
                  }
                  alt="Device"
                  className={styles.deviceImage}
                />
              </div>
              <div className={styles.onlineIndicator}></div>
            </div>
            <div className={styles.deviceInfo}>
              <h3 className={styles.deviceName}>Id: {device.clientName}</h3>
              <p className={styles.deviceId}>
                Status:{" "}
                <a style={{ color: "green", fontWeight: "bold" }}>Online</a>,
                Id: {device.clientId}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.manageButtonContainer}>
        <button
          className={styles.manageButton}
          onClick={openUploadModal}
          disabled={selectedDevices.size === 0}
        >
          Zarządzaj wybranymi ({selectedDevices.size})
        </button>
      </div>

      {isModalOpen && (
        <div className={styles.uploadModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Załaduj {activeTab === "photo" ? "zdjęcie" : (activeTab === "video" ? "film" : "plik")} dla {selectedDevices.size} wybranych urządzeń
              </h3>
              <button className={styles.closeButton} onClick={closeUploadModal} disabled={isLoading}>
                ×
              </button>
            </div>
            <div className={styles.tabSwitcher}>
              <button
                className={`${styles.tab} ${
                  activeTab === "photo" ? styles.activeTab : ""
                }`}
                onClick={() => {
                  setActiveTab("photo");
                  setFile(null);
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null);
                }}
                disabled={isLoading}
              >
                Zdjęcie
              </button>
              <button
                className={`${styles.tab} ${
                  activeTab === "video" ? styles.activeTab : ""
                }`}
                onClick={() => {
                  setActiveTab("video");
                  setFile(null);
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null);
                }}
                disabled={isLoading}
              >
                Film
              </button>
              <button
                className={`${styles.tab} ${
                  activeTab === "gallery" ? styles.activeTab : ""
                }`}
                onClick={() => {
                  setActiveTab("gallery");
                  setFile(null);
                  setPreviewUrl(null);
                }}
                disabled={isLoading}
              >
                Galeria plików
              </button>
            </div>
            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

            {isLoading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.spinner}></div>
                <p>{overallStatus}</p>
                <div className={styles.uploadProgressContainer}>
                  {Array.from(selectedDevices).map((deviceId) => {
                    const device = devices.find(d => d._id === deviceId);
                    const status = uploadProgress[deviceId] || "Oczekuje...";
                    return (
                      <p
                        key={deviceId}
                        className={`${styles.deviceUploadStatus} ${
                          status.includes("Sukces") ? styles.statusSuccess : ""
                        } ${status.includes("Błąd") ? styles.statusError : ""}`}
                      >
                        {device?.clientName || deviceId}: {status}
                      </p>
                    );
                  })}
                </div>
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
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className={styles.previewImage}
                      />
                    ) : (
                      <>
                        <video
                          src={previewUrl}
                          controls
                          ref={videoRef}
                          className={styles.previewImage}
                        />
                        {videoFPS && (
                          <div className={styles.fpsInfo}>FPS: {videoFPS}</div>
                        )}
                      </>
                    )}
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.dropZoneContent}>
                    <div className={styles.uploadIcon}>📁</div>
                    <p className={styles.dropText}>
                      Przeciągnij i upuść plik{" "}
                      {activeTab === "photo" ? "graficzny" : "wideo"} tutaj
                    </p>
                    <p className={styles.dropSubtext}>lub</p>
                  </div>
                )}
                <input
                  type="file"
                  accept={activeTab === "photo" ? "image/*" : "video/*"}
                  onChange={(e) =>
                    e.target.files.length > 0 && handleFile(e.target.files[0])
                  }
                  className={styles.fileInput}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div className={styles.galleryContainer}>
                {galleryFiles.length > 0 ? (
                  <div className={styles.fileGrid}>
                    {galleryFiles.map((filename) => (
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
                          disabled={isLoading}
                        />
                        {getFileType(filename) === 'image' || getFileType(filename) === 'video' ? (
                          <img
                            src={`${API_BASE_URL}/${locationId}/files/${filename}/thumbnail`}
                            alt={filename}
                            className={styles.galleryThumbnail}
                          />
                        ) : (
                          <div className={styles.galleryPlaceholder}>
                            <span className={styles.fileIcon}>📄</span>
                          </div>
                        )}
                        <span className={styles.galleryFileName}>
                          {filename}{" "}<br/>
                          {filename.endsWith(".png") && "(zdjęcie)"}
                          {filename.endsWith(".mp4") && "(film)"}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>Brak plików w galerii dla tej lokalizacji.</p>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                className={styles.uploadButton}
                onClick={handleMultiUpload}
                disabled={!(file || selectedGalleryFile) || isLoading}
              >
                {isLoading ? "Wysyłam..." : (activeTab === "gallery" ? "Wybierz plik" : "Wyślij plik")}
              </button>
              <button className={styles.cancelButton} onClick={closeUploadModal} disabled={isLoading}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageMultipleDevices;