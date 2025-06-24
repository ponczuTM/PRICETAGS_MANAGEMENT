import React, { useEffect, useState, useRef } from "react";
import styles from "./MainPage.module.css";

const locationId = "685003cbf071eb1bb4304cd2";

function MainPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedPhotos, setUploadedPhotos] = useState({});
  const [activeTab, setActiveTab] = useState("photo");
  const [errorMsg, setErrorMsg] = useState(null);
  const [videoFPS, setVideoFPS] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetch(`http://localhost:8000/api/locations/${locationId}/devices`)
      .then((res) => res.json())
      .then(setDevices)
      .catch((err) => console.error("Błąd pobierania urządzeń:", err));
  }, []);

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
    const isImage = activeTab === "photo" && f.type === "image/png";
    const isVideo =
      activeTab === "video" &&
      ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"].includes(f.type);

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
          ? "Dozwolony tylko plik PNG"
          : "Dozwolone pliki: MP4, MOV, AVI, MKV"
      );
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedDevice) return;

    const base64 = await toBase64(file);
    const deviceId = selectedDevice._id;
    const endpoint = activeTab === "photo" ? "photo" : "video";

    try {
      await fetch(`http://localhost:8000/api/locations/${locationId}/devices/${deviceId}/delete-files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      await fetch(`http://localhost:8000/api/locations/${locationId}/devices/${deviceId}/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [endpoint]: base64 }),
      });

      await fetch(`http://localhost:8000/api/locations/${locationId}/devices/${deviceId}/changed-true`, {
        method: "PUT",
      });

      setUploadedPhotos((prev) => ({
        ...prev,
        [deviceId]: {
          url: previewUrl,
          name: file.name,
          size: file.size,
          uploadDate: new Date().toLocaleString(),
          type: activeTab,
        },
      }));

      closeUpload();
    } catch (err) {
      console.error("Błąd wysyłania pliku:", err);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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

              {uploadedPhotos[device._id] && (
                <div className={styles.uploadedPhotoInfo}>
                  <div className={styles.uploadedPhotoPreview}>
                    <img 
                      src={uploadedPhotos[device._id].url} 
                      alt="Uploaded"
                      className={styles.miniPreview}
                    />
                  </div>
                  <div className={styles.photoDetails}>
                    <span className={styles.photoName}>{uploadedPhotos[device._id].name}</span>
                    <span className={styles.photoMeta}>
                      {formatFileSize(uploadedPhotos[device._id].size)} • {uploadedPhotos[device._id].uploadDate}
                    </span>
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
                Załaduj {activeTab === "photo" ? "zdjęcie PNG" : "film"} dla: {selectedDevice.clientName}
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
                    Przeciągnij i upuść plik {activeTab === "photo" ? "PNG" : "MP4/MOV/AVI/MKV"} tutaj
                  </p>
                  <p className={styles.dropSubtext}>lub</p>
                </div>
              )}
              
              <input
                type="file"
                accept={activeTab === "photo" ? "image/png" : "video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"}
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
