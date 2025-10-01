import React, { useState, useRef } from "react";
import { Rnd } from "react-rnd";
import styles from "./Editor.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/locations`;

const getCurrentLocationId = () => {
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
  const legacyId = localStorage.getItem("locationId");
  return legacyId || (initialLocationIds.length > 0 ? initialLocationIds[0] : null);
};

function Editor() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [fileName, setFileName] = useState("");

  const [elements, setElements] = useState([]);
  const [newText, setNewText] = useState("");
  const [newColor, setNewColor] = useState("#858585");
  const [newFontSize, setNewFontSize] = useState(24);
  const [editingElementId, setEditingElementId] = useState(null);

  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const editorRef = useRef(null);
  const currentLocationId = getCurrentLocationId();

  const getFileType = (filename) => {
    const ext = (filename || "").split(".").pop().toLowerCase();
    if (["jpg","jpeg","png","gif","bmp","webp"].includes(ext)) return "image";
    if (["mp4","mov","avi","mkv","webm"].includes(ext)) return "video";
    return "unknown";
  };

  const handleFileChange = (e) => {
    setErrorMsg(null);
    if (e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setElements([]);
      setFileName(selectedFile.name.split(".")[0]);
    }
  };

  const handleAddText = () => {
    if (!newText.trim() || !newFontSize) return;
    setElements([
      ...elements,
      {
        id: Date.now(),
        type: "text",
        content: newText,
        color: newColor,
        width: 5,
        height: 5,
        x: 10,
        y: 10,
        fontSize: newFontSize,
      },
    ]);
    setNewText("");
  };

  const handleAddShape = (shapeType) => {
    setElements([
      ...elements,
      {
        id: Date.now(),
        type: "shape",
        shape: shapeType,
        color: newColor,
        width: 100,
        height: 100,
        x: 10,
        y: 10,
      },
    ]);
  };

  const drawText = (ctx, text, x, y, maxWidth, fontSize, color) => {
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    const words = text.split(' ');
    let line = '';
    const lineHeight = fontSize * 1.2;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  };

  const handleSaveAndUpload = async () => {
    if (!file || !currentLocationId || !fileName.trim()) {
      setErrorMsg("Brak pliku, lokalizacji lub nazwy.");
      return;
    }

    const fileType = getFileType(file.name);
    if (fileType === "video") { return; }

    const img = new Image();
    img.src = previewUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const displayedImg = editorRef.current.querySelector("img");
      if (!displayedImg) return;

      const editorRect = editorRef.current.getBoundingClientRect();
      const imgRect = displayedImg.getBoundingClientRect();
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;
      
      elements.forEach(el => {
        // Pozycja elementu względem samego img w edytorze
        const x = (el.x) * scaleX;
        const y = (el.y) * scaleY;
        const w = el.width * scaleX;
        const h = el.height * scaleY;
      
        if (el.type === "text") {
          drawText(ctx, el.content, x, y, w, el.fontSize * scaleX, el.color);
        } else if (el.type === "shape") {
          ctx.fillStyle = el.color;
          let size = el.shape === "circle" || el.shape === "square" ? Math.min(w,h) : null;
          switch (el.shape) {
            case "circle":
              ctx.beginPath();
              ctx.arc(x + size/2, y + size/2, size/2, 0, 2*Math.PI);
              ctx.fill();
              break;
            case "square":
              ctx.fillRect(x, y, size, size);
              break;
            case "star":
              drawStar(ctx, x + w/2, y + h/2, 5, w/2, w/4, el.color);
              break;
          }
        }
      });
      

      canvas.toBlob(async blob => {
        const formData = new FormData();
        formData.append("file", blob, `${fileName}.png`);
        setIsUploading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/${currentLocationId}/upload-file/`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Błąd uploadu pliku");
          alert("Plik zapisany w galerii z elementami!");
          navigate("/gallery");
        } catch (err) {
          setErrorMsg(err.message);
        } finally {
          setIsUploading(false);
        }
      });
    };
  };

  const isImage = file && getFileType(file.name) === "image";

  // Shift detection
  React.useEffect(() => {
    const down = (e) => e.key === "Shift" && setIsShiftPressed(true);
    const up = (e) => e.key === "Shift" && setIsShiftPressed(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <>
      <Navbar />
      <div className={styles.container}>
        <h2 className={styles.title}>Edytor Plików dla Lokalizacji: {currentLocationId}</h2>

        {editingElementId && (
          <div className={styles.editTextPanel}>
            <h2>Edycja elementu</h2>
            {elements.find(e => e.id === editingElementId)?.type === "text" && (
              <>
                <input
                  type="text"
                  value={elements.find(e => e.id === editingElementId)?.content || ""}
                  onChange={e =>
                    setElements(elements.map(el =>
                      el.id === editingElementId
                        ? { ...el, content: e.target.value }
                        : el
                    ))
                  }
                />
                <input
                  type="number"
                  value={elements.find(e => e.id === editingElementId)?.fontSize || 0}
                  onChange={e =>
                    setElements(elements.map(el =>
                      el.id === editingElementId
                        ? { ...el, fontSize: Number(e.target.value) }
                        : el
                    ))
                  }
                />
              </>
            )}
            <input
              type="color"
              value={elements.find(e => e.id === editingElementId)?.color || "#ff0000"}
              onChange={e =>
                setElements(elements.map(el =>
                  el.id === editingElementId
                    ? { ...el, color: e.target.value }
                    : el
                ))
              }
            />
            <button onClick={() => setElements(elements.filter(e => e.id !== editingElementId))} style={{ backgroundColor: "#dc3545" }}>Usuń</button>
          </div>
        )}

        <div className={styles.contentWrapper}>
          <div className={styles.editorControls}>
            <div className={styles.controlGroup}>
              <h4>1. Wybierz Plik</h4>
              <input type="file" onChange={handleFileChange} accept="image/*" className={styles.fileInput} />
              {file && <p>Wybrany plik: <strong>{file.name}</strong></p>}
            </div>

            {isImage && (
              <>
                <div className={styles.controlGroup}>
                  <h4>2. Dodaj Kształty</h4>
                  <div className={styles.shapeButtons}>
                    <button onClick={() => handleAddShape("circle")} className={styles.shapeButton}>Koło</button>
                    <button onClick={() => handleAddShape("square")} className={styles.shapeButton}>Kwadrat</button>
                  </div>
                  {/* <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} /> */}
                </div>

                <div className={styles.controlGroup}>
                  <h4>3. Dodaj Tekst</h4>
                  <input type="text" value={newText} onChange={e => setNewText(e.target.value)} placeholder="Tekst..." className={styles.textInput} />
                  <input type="number" value={newFontSize} onChange={e => setNewFontSize(Number(e.target.value))} placeholder="Rozmiar fontu" className={styles.textInput} />
                  {/* <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} /> */}
                  <button onClick={handleAddText} className={styles.shapeButton}>Dodaj Tekst</button>
                </div>
              </>
            )}

            {previewUrl && (
              <div className={styles.controlGroup}>
                <h4>4. Nazwa pliku</h4>
                <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="Nazwa pliku..." className={styles.textInput} />
              </div>
            )}

            <button onClick={handleSaveAndUpload} disabled={!previewUrl || isUploading} className={styles.shapeButton}>
              {isUploading ? "Zapisywanie..." : "Zapisz i dodaj do galerii"}
            </button>

            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          </div>

          <div className={styles.editorArea} ref={editorRef}>
            {!previewUrl ? (
              <div className={styles.placeholder}>Wybierz plik, aby rozpocząć edycję</div>
            ) : (
              <div className={styles.editorCanvas}>
                {getFileType(file.name) === "image" ? (
                  <img src={previewUrl} alt="Edytowany" className={styles.mediaElement} />
                ) : getFileType(file.name) === "video" ? (
                  <video src={previewUrl} controls className={styles.mediaElement} />
                ) : (
                  <div>Nieobsługiwany typ pliku</div>
                )}

                {isImage && elements.map(el => {
                  const isSelected = el.id === editingElementId;
                  const lockRatio = isShiftPressed && (el.shape === "circle" || el.shape === "square");
                  const onResizeStart = () => {
                    // Jeśli Shift, natychmiast ustaw wymiary na idealne
                    if (lockRatio) {
                      const size = Math.min(el.width, el.height);
                      setElements(elements.map(e2 => e2.id === el.id ? { ...e2, width: size, height: size } : e2));
                    }
                  };

                  return (
                    <Rnd
                      key={el.id}
                      size={{ width: el.width, height: el.height }}
                      position={{ x: el.x, y: el.y }}
                      enableResizing={el.type === "shape" ? {
                        top: true,
                        right: true,
                        bottom: true,
                        left: true,
                        topRight: true,
                        bottomRight: true,
                        bottomLeft: true,
                        topLeft: true,
                      } : false}
                      lockAspectRatio={lockRatio}
                      onResizeStart={onResizeStart}
                      onDragStop={(e, d) => setElements(elements.map(e2 => e2.id === el.id ? { ...e2, x: d.x, y: d.y } : e2))}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        let newW = parseInt(ref.style.width);
                        let newH = parseInt(ref.style.height);
                        if (lockRatio) {
                          const size = Math.min(newW, newH);
                          newW = newH = size;
                        }
                        setElements(elements.map(e2 => e2.id === el.id ? { ...e2, width: newW, height: newH, x: position.x, y: position.y } : e2));
                      }}
                      bounds="parent"
                      className={isSelected ? styles.selectedShape : ""}
                      onClick={() => setEditingElementId(el.id)}
                    >
                      {el.type === "text" ? (
                        <div
                          style={{ color: el.color, fontSize: el.fontSize, fontWeight: "bold", cursor: "move", width: "100%", height: "100%", whiteSpace: "pre-wrap" }}
                        >
                          {el.content}
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "100%", height: "100%",
                            backgroundColor: el.color,
                            borderRadius: el.shape === "circle" ? "50%" : "0",
                            cursor: "move"
                          }}
                        />
                      )}
                    </Rnd>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Editor;
