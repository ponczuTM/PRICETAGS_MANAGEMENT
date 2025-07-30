import React, { useEffect, useState } from "react";
import styles from "./Gallery.module.css";
import Navbar from "./Navbar";

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

function Gallery() {
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  useEffect(() => {
    fetchGalleryFiles();
  }, []);

  const fetchGalleryFiles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/files/`);
      if (!res.ok) throw new Error("Błąd podczas pobierania plików galerii");
      const data = await res.json();
      setGalleryFiles(data.files);
    } catch (err) {
      console.error("Błąd pobierania plików galerii:", err);
      setErrorMsg("Nie udało się załadować plików galerii.");
    }
  };

  const getFileType = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) return "image";
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
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/upload-file/`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Błąd podczas przesyłania pliku");
      setFile(null);
      setPreviewUrl(null);
      fetchGalleryFiles();
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
    if (!fileToDelete) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${locationId}/files/${fileToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Błąd usuwania pliku");
      setShowModal(false);
      setFileToDelete(null);
      fetchGalleryFiles();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Nie udało się usunąć pliku.");
    }
  };

  return (
    <>
      <Navbar />
      <div className={styles.container}>
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
              const fileUrl = `${API_BASE_URL}/${locationId}/files/${filename}`;

              return (
                <div key={filename} className={styles.galleryItem}>
                  <button
                    className={styles.deleteButton}
                    onClick={() => confirmDelete(filename)}
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

        {previewUrl && (
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
            <p>Jeśli plik znajduje się w dowolnym harmonogramie, plik zostanie pominięty podczas aktualizacji contentu na urządzeniach</p>
              <div className={styles.modalActions}>
                <button onClick={handleDelete} className={styles.confirmButton}>Tak</button>
                <button onClick={() => setShowModal(false)} className={styles.cancelButton}>Nie</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Gallery;