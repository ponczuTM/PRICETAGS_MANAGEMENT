import React, { useEffect, useState, useRef } from "react";
import styles from "./MainPage.module.css";

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

function MainPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [file, setFile] = useState(null); // Dla plików przesyłanych
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [activeTab, setActiveTab] = useState("photo"); // photo, video, gallery
  const [errorMsg, setErrorMsg] = useState(null);
  const [videoFPS, setVideoFPS] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]); // Nowy stan dla plików w galerii
  const [selectedGalleryFile, setSelectedGalleryFile] = useState(null); // Nowy stan dla wybranego pliku z galerii
  const videoRef = useRef(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  // Gdy zmienia się selectedDevice lub activeTab na "gallery", pobierz pliki dla galerii
  useEffect(() => {
    if (selectedDevice && activeTab === "gallery") {
      fetchGalleryFiles();
    }
  }, [selectedDevice, activeTab]);

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
    // Resetuj wybrany plik z galerii, jeśli użytkownik przeciąga nowy
    setSelectedGalleryFile(null);

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
    // Ustaw wybrany plik z galerii i zresetuj stan uploadu
    setSelectedGalleryFile(filename);
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setVideoFPS(null);
  };

  const handleUpload = async () => {
    if (!selectedDevice) {
      setErrorMsg("Wybierz urządzenie.");
      return;
    }

    let filenameToUse = null;

    if (selectedGalleryFile) {
      // Przypadek 1: Plik wybrany z galerii
      filenameToUse = selectedGalleryFile;
    } else if (file) {
      // Przypadek 2: Plik przeciągnięty/wybrany do uploadu
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
        setErrorMsg("Wystąpił błąd podczas przesyłania pliku");
        return;
      }
    } else {
      setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
      return;
    }

    // Jeśli mamy nazwę pliku do użycia (z uploadu lub z galerii)
    if (filenameToUse) {
      try {
        // Określenie, które pole w urządzeniu ma być zaktualizowane (photo/video)
        // Bazujemy na typie pliku, a nie na aktywnej zakładce, aby zapewnić spójność
        const fileTypeActual = getFileType(filenameToUse);
        let fieldToUpdate = null;

        if (fileTypeActual === 'image') {
          fieldToUpdate = 'photo';
        } else if (fileTypeActual === 'video') {
          fieldToUpdate = 'video';
        } else {
          // Obsługa przypadku, gdy plik nie jest ani obrazem, ani wideo
          setErrorMsg("Wybrany plik z galerii nie jest zdjęciem ani filmem i nie może zostać przypisany.");
          return;
        }

        if (!fieldToUpdate) {
            setErrorMsg("Nie można określić typu pliku do aktualizacji.");
            return;
        }

        // Żądanie 1: Aktualizacja pola 'photo' lub 'video'
        const updateFieldResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/${fieldToUpdate}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [fieldToUpdate]: filenameToUse }),
          }
        );

        if (!updateFieldResponse.ok) {
          throw new Error(`Błąd podczas aktualizacji pola ${fieldToUpdate} w urządzeniu`);
        }

        // Żądanie 2: Ustawienie flagi 'changed' na true
        const updateChangedFlagResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/changed-true`,
          { method: "PUT" }
        );

        if (!updateChangedFlagResponse.ok) {
          throw new Error("Błąd podczas ustawiania flagi 'changed' na true");
        }

        // Żądanie 3: Ustawienie miniaturki (thumbnail)
        const updateThumbnailResponse = await fetch(
          `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/thumbnail`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              thumbnail: `${filenameToUse.split(".")[0]}.png`,
            }),
          }
        );

        if (!updateThumbnailResponse.ok) {
          throw new Error("Błąd podczas aktualizacji miniaturki urządzenia");
        }

        

        if (!updateChangedFlagResponse.ok) {
          throw new Error("Błąd podczas ustawiania flagi 'changed' na true");
        }

        // Aktualizacja stanu UI po sukcesie
        setUploadedFiles((prev) => ({
          ...prev,
          [selectedDevice._id]: {
            ...prev[selectedDevice._id],
            [`${fieldToUpdate}Url`]: `${API_BASE_URL}/${locationId}/files/${filenameToUse}`,
          },
        }));

        closeUpload();
        fetchDevices(); // Odśwież listę urządzeń, aby UI odzwierciedlało zmiany
      } catch (err) {
        console.error("Błąd podczas aktualizacji urządzenia:", err);
        setErrorMsg(`Wystąpił błąd podczas aktualizacji urządzenia: ${err.message}`);
      }
    }
  };

  const handleDeleteFile = async (fileType) => {
    if (!selectedDevice) return;

    try {
      // Wyczyść pole w urządzeniu
      const updateResponse = await fetch(
        `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/${fileType}`,
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
        `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/changed-true`,
        {
          method: "PUT",
        }
      );

      // Zaktualizuj stan
      setUploadedFiles((prev) => ({
        ...prev,
        [selectedDevice._id]: {
          ...prev[selectedDevice._id],
          [`${fileType}Url`]: null,
        },
      }));

      fetchDevices(); // Odśwież listę urządzeń
    } catch (err) {
      console.error("Błąd usuwania pliku:", err);
      setErrorMsg("Wystąpił błąd podczas usuwania pliku");
    }
  };

  const closeUpload = () => {
    setSelectedDevice(null);
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setActiveTab("photo");
    setVideoFPS(null);
    setGalleryFiles([]); // Wyczyść pliki galerii przy zamknięciu
    setSelectedGalleryFile(null); // Wyczyść wybrany plik galerii
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Funkcja do sprawdzenia typu pliku na podstawie rozszerzenia
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

  // Opcjonalna filtracja plików galerii na podstawie aktywnej zakładki
  // const filteredGalleryFiles = galleryFiles.filter(filename => {
  //   const fileType = getFileType(filename);
  //   if (activeTab === 'photo') return fileType === 'image';
  //   if (activeTab === 'video') return fileType === 'video';
  //   return true; // W zakładce "Galeria" pokazuj wszystkie
  // });


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lista urządzeń</h2>
        <div className={styles.deviceCount}>{devices.length} urządzeń</div>
      </div>

      <div className={styles.deviceGrid}>
        {devices.map((device) => (
          <div
            key={device._id}
            className={`${styles.deviceCard} ${
              selectedDevice?._id === device._id ? styles.selected : ""
            }`}
            onClick={() => setSelectedDevice(device)}
          >
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

      {selectedDevice && (
        <div className={styles.uploadModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Załaduj {activeTab === "photo" ? "zdjęcie" : (activeTab === "video" ? "film" : "plik")} dla: {selectedDevice.clientName}
              </h3>
              <button className={styles.closeButton} onClick={closeUpload}>
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
                  setFile(null); // Resetuj plik do uploadu
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null); // Resetuj wybrany plik z galerii
                }}
              >
                Zdjęcie
              </button>
              <button
                className={`${styles.tab} ${
                  activeTab === "video" ? styles.activeTab : ""
                }`}
                onClick={() => {
                  setActiveTab("video");
                  setFile(null); // Resetuj plik do uploadu
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null); // Resetuj wybrany plik z galerii
                }}
              >
                Film
              </button>
              <button
                className={`${styles.tab} ${
                  activeTab === "gallery" ? styles.activeTab : ""
                }`}
                onClick={() => {
                  setActiveTab("gallery");
                  setFile(null); // Resetuj plik do uploadu
                  setPreviewUrl(null);
                  // Opcjonalnie: setSelectedGalleryFile(null); jeśli chcesz resetować wybór po przejściu do galerii
                }}
              >
                Galeria plików
              </button>
            </div>

            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

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
                />
              </div>
            ) : (
              // Sekcja galerii z radiobuttonami
              <div className={styles.galleryContainer}>
                {galleryFiles.length > 0 ? (
                  <div className={styles.fileGrid}>
                    {/* Możesz użyć filteredGalleryFiles tutaj, jeśli chcesz filtrować */}
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
                        />
                        {getFileType(filename) === 'image' || getFileType(filename) === 'video' ? (
                          // Miniatura pliku, jeśli jest to obraz lub wideo
                          <img
                            src={`${API_BASE_URL}/${locationId}/files/${filename}/thumbnail`}
                            alt={filename}
                            className={styles.galleryThumbnail}
                          />
                        ) : (
                          // Placeholder dla innych typów plików
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
                onClick={handleUpload}
                disabled={!(file || selectedGalleryFile)}
              >
                {activeTab === "gallery" ? "Wybierz plik" : "Wyślij plik"}
              </button>
              <button className={styles.cancelButton} onClick={closeUpload}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainPage;