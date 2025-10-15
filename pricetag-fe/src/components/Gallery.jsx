import React, { useEffect, useState } from "react";
import styles from "./Gallery.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/locations`;

function Gallery() {
  const navigate = useNavigate();

  // === Pobranie usera i locationIds z localStorage (z fallbackiem na legacy) ===
  const storedUser = localStorage.getItem("user");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;

  const initialLocationIds = (() => {
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

  const [locationIds, setLocationIds] = useState(initialLocationIds);
  const [currentLocationId, setCurrentLocationId] = useState(() => {
    const legacy = localStorage.getItem("locationId");
    return legacy || (initialLocationIds.length > 0 ? initialLocationIds[0] : null);
  });

  const [galleryFiles, setGalleryFiles] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

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

  // Reaguj na zmianę currentLocationId
  useEffect(() => {
    if (!currentLocationId) return;
    fetchGalleryFiles(currentLocationId);
    setErrorMsg(null);
  }, [currentLocationId]);

  const handleSwitchLocation = (locId) => {
    setCurrentLocationId(locId);
    localStorage.setItem("locationId", locId); // legacy zgodność
  };

  const fetchGalleryFiles = async (locId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locId}/files/`);
      if (!res.ok) throw new Error("Błąd podczas pobierania plików galerii");
      const data = await res.json();
      setGalleryFiles(data.files || []);
    } catch (err) {
      console.error("Błąd pobierania plików galerii:", err);
      setErrorMsg("Nie udało się załadować plików galerii.");
    }
  };

  const getFileType = (filename) => {
    const ext = (filename || "").split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "image";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
    return "unknown";
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setPreviewUrl(URL.createObjectURL(droppedFile));
    }
  };

  const handleUpload = async () => {
    if (!file || !currentLocationId) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/${currentLocationId}/upload-file/`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Błąd podczas przesyłania pliku");
      setFile(null);
      setPreviewUrl(null);
      fetchGalleryFiles(currentLocationId);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Nie udało się wysłać pliku.");
    }
  };

  const confirmDelete = (filename) => {
    setFileToDelete(filename);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete || !currentLocationId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${currentLocationId}/files/${fileToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Błąd usuwania pliku");
      setShowModal(false);
      setFileToDelete(null);
      fetchGalleryFiles(currentLocationId);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Nie udało się usunąć pliku.");
    }
  };

  // === NOWE: pobieranie pliku ===
  const handleDownload = async (filename) => {
    if (!currentLocationId || !filename) return;
    const fileUrl = `${API_BASE_URL}/${currentLocationId}/files/${filename}`;
    try {
      // Bezpieczny wariant: pobieramy blob i wymuszamy nazwę pliku
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Błąd pobierania pliku");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // podpowiedz nazwy pliku
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      // Fallback: spróbuj bezpośredniego otwarcia, przeglądarka może zainicjować download
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = filename;
      a.target = "_self";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

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
          <h2 className={styles.title}>Galeria plików</h2>
          <div className={styles.deviceCount}>{galleryFiles.length} plików</div>
        </div>

        {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

        {galleryFiles.length === 0 ? (
          <p className={styles.empty}>Brak plików w galerii.</p>
        ) : (
          <div className={styles.fileGrid}>
            {galleryFiles.map((filename) => {
              const fileType = getFileType(filename);
              const fileUrl = `${API_BASE_URL}/${currentLocationId}/files/${filename}`;

              return (
                <div key={filename} className={styles.galleryItem}>
                  {/* NOWE: przycisk pobierania (lewy górny róg) */}
                  <button
                    className={styles.downloadButton}
                    onClick={() => handleDownload(filename)}
                    title="Pobierz plik"
                    aria-label={`Pobierz ${filename}`}
                  >
                    <svg
                      className={styles.downloadIcon}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 3v10" />
                      <path d="M8 11l4 4 4-4" />
                      <path d="M6 19h12" />
                    </svg>
                  </button>


                  {/* Istniejący przycisk usuwania (prawy górny róg) */}
                  <button
                    className={styles.deleteButton}
                    onClick={() => confirmDelete(filename)}
                    title="Usuń plik"
                    aria-label={`Usuń ${filename}`}
                  >
                    ×
                  </button>

                  <div className={styles.galleryMediaWrapper}>
                    {fileType === "image" ? (
                      <img src={fileUrl} alt={filename} className={styles.galleryMedia} />
                    ) : fileType === "video" ? (
                      <video src={fileUrl} autoPlay loop muted className={styles.galleryMedia} />
                    ) : (
                      <div className={styles.galleryPlaceholder}>
                        <span className={styles.fileIcon}>📄</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.galleryFileName}>{filename}</div>
                </div>
              );
            })}
          </div>
        )}

        <div
          className={styles.dropzone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p>Przeciągnij i upuść plik tutaj lub kliknij, aby wybrać</p>
          <input
            type="file"
            onChange={handleFileChange}
            className={styles.uploadInput}
          />
        </div>

        {previewUrl && file && (
          <div className={styles.previewContainer}>
            {getFileType(file.name) === "image" ? (
              <img src={previewUrl} alt="Podgląd" className={styles.previewImage} />
            ) : (
              <video src={previewUrl} controls className={styles.previewImage} />
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file}
          className={styles.uploadButton}
        >
          Dodaj plik
        </button>

        {showModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalBox}>
              <p>Czy na pewno chcesz usunąć plik "{fileToDelete}" z galerii?</p>
              <p>
                Jeśli plik znajduje się w dowolnym harmonogramie, plik zostanie
                pominięty podczas aktualizacji contentu na urządzeniach
              </p>
              <div className={styles.modalActions}>
                <button onClick={handleDelete} className={styles.confirmButton}>
                  Tak
                </button>
                <button onClick={() => setShowModal(false)} className={styles.cancelButton}>
                  Nie
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Gallery;
