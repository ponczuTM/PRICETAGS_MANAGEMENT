import React, { useEffect, useState, useRef } from "react";
import styles from "./MainPage.module.css";

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

function MainPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [activeTab, setActiveTab] = useState("photo");
  const [errorMsg, setErrorMsg] = useState(null);
  const [videoFPS, setVideoFPS] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetchDevices();
  }, []);

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
          videoUrl: device.video ? `${API_BASE_URL}/${locationId}/files/${device.video}` : null
        };
      }
      setUploadedFiles(filesInfo);
    } catch (err) {
      console.error("Błąd pobierania urządzeń:", err);
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

  const handleUpload = async () => {
    if (!file || !selectedDevice) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Wyślij plik na serwer
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
      const filename = uploadResult.filename;

      // Zaktualizuj odpowiednie pole w urządzeniu (photo lub video)
      const updateResponse = await fetch(
        `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/${activeTab}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [activeTab]: filename }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Błąd podczas aktualizacji urządzenia");
      }

      // Oznacz urządzenie jako zmienione
      await fetch(
        `${API_BASE_URL}/${locationId}/devices/${selectedDevice._id}/changed-true`,
        {
          method: "PUT",
        }
      );

      // Zaktualizuj stan z nowym plikiem
      setUploadedFiles(prev => ({
        ...prev,
        [selectedDevice._id]: {
          ...prev[selectedDevice._id],
          [`${activeTab}Url`]: `${API_BASE_URL}/${locationId}/files/${filename}`
        }
      }));

      closeUpload();
      fetchDevices(); // Odśwież listę urządzeń
    } catch (err) {
      console.error("Błąd wysyłania pliku:", err);
      setErrorMsg("Wystąpił błąd podczas przesyłania pliku");
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
      setUploadedFiles(prev => ({
        ...prev,
        [selectedDevice._id]: {
          ...prev[selectedDevice._id],
          [`${fileType}Url`]: null
        }
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
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
            className={`${styles.deviceCard} ${selectedDevice?._id === device._id ? styles.selected : ''}`}
            onClick={() => setSelectedDevice(device)}
          >
            <div className={styles.deviceImageContainer}>
              <img 
                src="/src/assets/images/device.png" 
                alt="Device" 
                className={styles.deviceImage}
              />
              <div className={styles.onlineIndicator}></div>
            </div>

            <div className={styles.deviceInfo}>
              <h3 className={styles.deviceName}>Id: {device.clientName}</h3>
              <p className={styles.deviceId}>Status: <a style={{color: "green", fontWeight: "bold"}}>Online</a>, Id: {device.clientId}</p>

              {uploadedFiles[device._id]?.photoUrl && (
                <div className={styles.uploadedFileInfo}>
                  <div className={styles.uploadedFilePreview}>
                    <img 
                      src={uploadedFiles[device._id].photoUrl} 
                      alt="Uploaded photo"
                      className={styles.miniPreview}
                    />
                  </div>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileType}>Zdjęcie</span>
                    {selectedDevice?._id === device._id && (
                      <button 
                        className={styles.deleteFileButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile("photo");
                        }}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              )}

              {uploadedFiles[device._id]?.videoUrl && (
                <div className={styles.uploadedFileInfo}>
                  <div className={styles.uploadedFilePreview}>
                    <video 
                      src={uploadedFiles[device._id].videoUrl} 
                      className={styles.miniPreview}
                      muted
                      playsInline
                    />
                  </div>
                  <div className={styles.fileDetails}>
                    <span className={styles.fileType}>Wideo</span>
                    {selectedDevice?._id === device._id && (
                      <button 
                        className={styles.deleteFileButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile("video");
                        }}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedDevice && (
        <div className={styles.uploadModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Załaduj {activeTab === "photo" ? "zdjęcie" : "film"} dla: {selectedDevice.clientName}
              </h3>
              <button 
                className={styles.closeButton}
                onClick={closeUpload}
              >
                ×
              </button>
            </div>

            <div className={styles.tabSwitcher}>
              <button
                className={`${styles.tab} ${activeTab === "photo" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("photo")}
              >
                Zdjęcie
              </button>
              <button
                className={`${styles.tab} ${activeTab === "video" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("video")}
              >
                Film
              </button>
            </div>

            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

            <div
              className={`${styles.dropZone} ${file ? styles.hasFile : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {previewUrl ? (
                <div className={styles.previewContainer}>
                  {activeTab === "photo" ? (
                    <img src={previewUrl} alt="Preview" className={styles.previewImage} />
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
                    <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.dropZoneContent}>
                  <div className={styles.uploadIcon}>📁</div>
                  <p className={styles.dropText}>
                    Przeciągnij i upuść plik {activeTab === "photo" ? "graficzny" : "wideo"} tutaj
                  </p>
                  <p className={styles.dropSubtext}>lub</p>
                </div>
              )}
              
              <input
                type="file"
                accept={activeTab === "photo" ? "image/*" : "video/*"}
                onChange={(e) => e.target.files.length > 0 && handleFile(e.target.files[0])}
                className={styles.fileInput}
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.uploadButton}
                onClick={handleUpload} 
                disabled={!file}
              >
                Wyślij plik
              </button>
              <button 
                className={styles.cancelButton}
                onClick={closeUpload}
              >
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