import React, { useEffect, useState, useRef } from "react";
import styles from "./MainPage.module.css";

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

function MainPage() {
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

  const videoRef = useRef(null); // This ref is no longer strictly necessary for FPS, but kept for potential future video controls

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevices.length > 0 && activeTab === "gallery") {
      fetchGalleryFiles();
    }
  }, [selectedDevices, activeTab]);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/devices`);
      const devicesData = await res.json();
      setDevices(devicesData);

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

  const handleMassUpload = async () => {
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
    selectedDevices.forEach(device => {
      initialStatuses[device._id] = { status: 'pending', message: 'Oczekuje...' };
    });
    setUploadStatuses(initialStatuses);

    let filenameToUse = null;

    if (file) {
      setUploadStatuses(prev => {
        const newStatuses = { ...prev };
        selectedDevices.forEach(device => {
          newStatuses[device._id] = { status: 'uploading_file', message: `${device.clientName}, ${device.clientId}: Wysyłanie pliku głównego...` };
        });
        return newStatuses;
      });

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
        setUploadStatuses(prev => {
          const newStatuses = { ...prev };
          selectedDevices.forEach(device => {
            newStatuses[device._id] = { status: 'error', message: `${device.clientName}, ${device.clientId}: Błąd uploadu pliku: ${err.message}` };
          });
          return newStatuses;
        });
        return;
      }
    } else if (selectedGalleryFile) {
      filenameToUse = selectedGalleryFile;
    } else {
      setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
      return;
    }

    if (filenameToUse) {
      const fileTypeActual = getFileType(filenameToUse);
      let fieldToUpdate = null;

      if (fileTypeActual === 'image') {
        fieldToUpdate = 'photo';
      } else if (fileTypeActual === 'video') {
        fieldToUpdate = 'video';
      } else {
        setErrorMsg("Wybrany plik z galerii nie jest zdjęciem ani filmem i nie może zostać przypisany.");
        return;
      }

      for (let i = 0; i < selectedDevices.length; i++) {
        const device = selectedDevices[i];
        setUploadStatuses(prev => ({
          ...prev,
          [device._id]: { status: 'in_progress', message: `${device.clientName}, ${device.clientId}: Aktualizowanie...` }
        }));

        try {
          await fetch(
            `${API_BASE_URL}/${locationId}/devices/${device._id}/delete-files`,
            { method: "DELETE" }
          );

          const updateFieldResponse = await fetch(
            `${API_BASE_URL}/${locationId}/devices/${device._id}/${fieldToUpdate}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ [fieldToUpdate]: filenameToUse }),
            }
          );

          if (!updateFieldResponse.ok) {
            throw new Error(`Błąd podczas aktualizacji pola ${fieldToUpdate}`);
          }

          const updateChangedFlagResponse = await fetch(
            `${API_BASE_URL}/${locationId}/devices/${device._id}/changed-true`,
            { method: "PUT" }
          );

          if (!updateChangedFlagResponse.ok) {
            throw new Error("Błąd podczas ustawiania flagi 'changed' na true");
          }

          const updateThumbnailResponse = await fetch(
            `${API_BASE_URL}/${locationId}/devices/${device._id}/thumbnail`,
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

          setUploadStatuses(prev => ({
            ...prev,
            [device._id]: { status: 'success', message: `${device.clientName}, ${device.clientId}: Zakończono sukcesem` }
          }));

        } catch (err) {
          console.error(`Błąd podczas aktualizacji urządzenia ${device.clientName}:`, err);
          setUploadStatuses(prev => ({
            ...prev,
            [device._id]: { status: 'error', message: `${device.clientName}, ${device.clientId}: Błąd: ${err.message}` }
          }));
        }
      }
      fetchDevices();
      setIsModalOpen(false);
      setSelectedDevices([]);
      setFile(null);
      setPreviewUrl(null);
      setSelectedGalleryFile(null);
      setUploadStatuses({}); // Wyczyść statusy po zakończeniu uploadu
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
    setUploadStatuses({}); // Wyczyść statusy przy zamykaniu modala
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
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'video';
    }
    return 'unknown';
  };

  const handleDeviceSelectToggle = (device) => {
    setSelectedDevices(prevSelected => {
      const newSelected = prevSelected.some(d => d._id === device._id)
        ? prevSelected.filter(d => d._id !== device._id)
        : [...prevSelected, device];
      
      // Wyczyść statusy uploadu za każdym razem, gdy zmieniasz zaznaczone urządzenia
      setUploadStatuses({}); 
      return newSelected;
    });
    setErrorMsg(null); // Wyczyść błąd, jeśli był
  };

  const handleSelectAllToggle = () => {
    if (selectedDevices.length === devices.length) {
      // All are selected, deselect all
      setSelectedDevices([]);
    } else {
      // Not all are selected, select all
      setSelectedDevices([...devices]);
    }
    setUploadStatuses({}); // Clear statuses when selecting/deselecting all
    setErrorMsg(null);
  };

  const getDeviceNameAndId = (deviceId) => {
    const device = devices.find(d => d._id === deviceId);
    return device ? `${device.clientName}, ${device.clientId}` : 'Nieznane urządzenie';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Lista urządzeń</h2>
        <div className={styles.deviceCount}>{devices.length} urządzeń</div>
      </div>

      <div className={styles.selectAllContainer}>
        <button
          className={styles.selectAllButton}
          onClick={handleSelectAllToggle}
        >
          {selectedDevices.length === devices.length
            ? "Odznacz wszystkie"
            : "Zaznacz wszystkie"}
        </button>
      </div>

      <div className={styles.deviceGrid}>
        {devices.map((device) => (
          <div
            key={device._id}
            className={`${styles.deviceCard} ${
              selectedDevices.some(d => d._id === device._id) ? styles.selected : ""
            }`}
            onClick={() => handleDeviceSelectToggle(device)}
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

      {selectedDevices.length > 0 && (
        <div className={styles.manageButtonContainer}>
          <button
            className={styles.manageButton}
            onClick={() => setIsModalOpen(true)}
          >
            Zarządzaj ({selectedDevices.length}) urządzeń
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.uploadModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Załaduj {activeTab === "photo" ? "zdjęcie" : (activeTab === "video" ? "film" : "plik")} dla wybranych urządzeń
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
                  setFile(null);
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null);
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
                  setFile(null);
                  setPreviewUrl(null);
                  setSelectedGalleryFile(null);
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
                  setFile(null);
                  setPreviewUrl(null);
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
                  {selectedDevices.map(device => (
                    <li key={device._id} className={`${styles.modalUploadStatusItem} ${styles[uploadStatuses[device._id]?.status || 'pending']}`}>
                      <span className={styles.deviceNameInStatus}>{device.clientName}, {device.clientId}:</span> {uploadStatuses[device._id]?.message || 'Oczekuje...'}
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
  );
}

export default MainPage;