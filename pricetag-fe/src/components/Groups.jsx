import React, { useEffect, useState, useRef } from "react";
import styles from "./Groups.module.css"; // Assuming you'll create a new CSS module
// You can reuse some styles from MainPage.module.css if they are general enough
// or create new specific styles in Groups.module.css

const locationId = "685003cbf071eb1bb4304cd2";
const API_BASE_URL = "http://localhost:8000/api/locations";

function Groups() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
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
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [deviceToManageGroups, setDeviceToManageGroups] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");

  const getDisplayName = (clientName) => {
    return editedNames[clientName] || clientName;
  };

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

  useEffect(() => {
    fetchDevicesAndGroups();
  }, []);

  useEffect(() => {
    if (selectedDevices.length > 0 && activeTab === "gallery") {
      fetchGalleryFiles();
    }
  }, [selectedDevices, activeTab]);

  const fetchDevicesAndGroups = async () => {
    try {
      const [devicesRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/${locationId}/devices`),
        fetch(`${API_BASE_URL}/${locationId}/groups`),
      ]);

      const devicesData = await devicesRes.json();
      const groupsData = await groupsRes.json();

      // For devices without 'groups' array, initialize it as empty
      const processedDevices = devicesData.map(device => ({
        ...device,
        groups: device.groups || []
      }));

      setDevices(processedDevices);
      setGroups(groupsData);

      // Initialize uploadedFiles state similarly to MainPage
      const filesInfo = {};
      for (const device of processedDevices) {
        filesInfo[device._id] = {
          photoUrl: device.photo ? `${API_BASE_URL}/${locationId}/files/${device.photo}` : null,
          videoUrl: device.video ? `${API_BASE_URL}/${locationId}/files/${device.video}` : null,
        };
      }
      // This is not used in the provided MainPage code for display, but it's good to keep if needed
      // setUploadedFiles(filesInfo);
    } catch (err) {
      console.error("Błąd pobierania urządzeń lub grup:", err);
      setErrorMsg("Nie udało się załadować urządzeń lub grup.");
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
          newStatuses[device._id] = { status: 'uploading_file', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Wysyłanie pliku głównego...` };
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
            newStatuses[device._id] = { status: 'error', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Błąd uploadu pliku: ${err.message}` };
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
          [device._id]: { status: 'in_progress', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Aktualizowanie...` }
        }));
        try {
          // Delete existing files (photo/video)
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
                thumbnail: filenameToUse,
              }),
            }
          );
          if (!updateThumbnailResponse.ok) {
            throw new Error("Błąd podczas aktualizacji miniaturki urządzenia");
          }
          setUploadStatuses(prev => ({
            ...prev,
            [device._id]: { status: 'success', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Zakończono sukcesem` }
          }));
        } catch (err) {
          console.error(`Błąd podczas aktualizacji urządzenia ${getDisplayName(device.clientName)}:`, err);
          setUploadStatuses(prev => ({
            ...prev,
            [device._id]: { status: 'error', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Błąd: ${err.message}` }
          }));
        }
      }
      fetchDevicesAndGroups(); // Re-fetch to update device list and their assigned files
      setIsModalOpen(false);
      setSelectedDevices([]);
      setFile(null);
      setPreviewUrl(null);
      setSelectedGalleryFile(null);
      setUploadStatuses({});
    }
  };

  const closeUploadModal = () => {
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
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return 'video';
    }
    return 'unknown';
  };

  const handleDeviceSelectToggle = (device) => {
    setSelectedDevices(prevSelected => {
      const newSelected = prevSelected.some(d => d._id === device._id)
        ? prevSelected.filter(d => d._id !== device._id)
        : [...prevSelected, device];
      setUploadStatuses({});
      return newSelected;
    });
    setErrorMsg(null);
  };

  const handleGroupSelectAllToggle = (groupId) => {
    const devicesInGroup = devices.filter(device =>
      device.groups.includes(groupId)
    );
    const allSelectedInGroup = devicesInGroup.every(device =>
      selectedDevices.some(d => d._id === device._id)
    );

    setSelectedDevices(prevSelected => {
      let newSelected = [...prevSelected];
      if (allSelectedInGroup) {
        // Deselect all in this group
        newSelected = newSelected.filter(device =>
          !devicesInGroup.some(d => d._id === device._id)
        );
      } else {
        // Select all in this group that are not already selected
        devicesInGroup.forEach(device => {
          if (!newSelected.some(d => d._id === device._id)) {
            newSelected.push(device);
          }
        });
      }
      setUploadStatuses({});
      return newSelected;
    });
    setErrorMsg(null);
  };

  // Group Management
  const openGroupManagementModal = (device) => {
    setDeviceToManageGroups(device);
    setIsGroupModalOpen(true);
  };

  const closeGroupManagementModal = () => {
    setDeviceToManageGroups(null);
    setIsGroupModalOpen(false);
    setNewGroupName("");
    setNewGroupDescription("");
  };

  const handleAddDeviceToGroup = async (groupId) => {
    if (!deviceToManageGroups) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/${locationId}/devices/${deviceToManageGroups._id}/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        }
      );
      if (!response.ok) {
        throw new Error("Błąd podczas dodawania urządzenia do grupy.");
      }
      await fetchDevicesAndGroups(); // Re-fetch to update UI
      // Update deviceToManageGroups to reflect the change immediately
      setDeviceToManageGroups(prev => ({
        ...prev,
        groups: [...prev.groups, groupId]
      }));
    } catch (err) {
      console.error("Błąd dodawania urządzenia do grupy:", err);
      setErrorMsg("Nie udało się dodać urządzenia do grupy.");
    }
  };

  const handleRemoveDeviceFromGroup = async (groupId) => {
    if (!deviceToManageGroups) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/${locationId}/devices/${deviceToManageGroups._id}/groups/${groupId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        throw new Error("Błąd podczas usuwania grupy z urządzenia.");
      }
      await fetchDevicesAndGroups(); // Re-fetch to update UI
      // Update deviceToManageGroups to reflect the change immediately
      setDeviceToManageGroups(prev => ({
        ...prev,
        groups: prev.groups.filter(id => id !== groupId)
      }));
    } catch (err) {
      console.error("Błąd usuwania grupy z urządzenia:", err);
      setErrorMsg("Nie udało się usunąć grupy z urządzenia.");
    }
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      setErrorMsg("Nazwa nowej grupy nie może być pusta.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/${locationId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDescription.trim() }),
      });
      if (!response.ok) {
        throw new Error("Błąd podczas tworzenia nowej grupy.");
      }
      const newGroup = await response.json();
      setGroups(prevGroups => [...prevGroups, newGroup]);
      setNewGroupName("");
      setNewGroupDescription("");
      setErrorMsg(null); // Clear any previous errors
      // If we're managing a device, automatically add it to the new group
      if (deviceToManageGroups) {
        await handleAddDeviceToGroup(newGroup._id);
      }
    } catch (err) {
      console.error("Błąd tworzenia nowej grupy:", err);
      setErrorMsg("Nie udało się stworzyć nowej grupy: " + err.message);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (window.confirm("Czy na pewno chcesz usunąć tę grupę? Spowoduje to również usunięcie jej z przypisanych urządzeń.")) {
      try {
        const response = await fetch(`${API_BASE_URL}/${locationId}/groups/${groupId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Błąd podczas usuwania grupy.");
        }
        await fetchDevicesAndGroups(); // Re-fetch all to update device group lists
        setErrorMsg(null);
      } catch (err) {
        console.error("Błąd usuwania grupy:", err);
        setErrorMsg("Nie udało się usunąć grupy: " + err.message);
      }
    }
  };

  const getDevicesInGroup = (groupId) => {
    return devices.filter(device => device.groups.includes(groupId));
  };

  const getDevicesWithoutGroup = () => {
    return devices.filter(device => device.groups.length === 0);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Zarządzanie grupami i urządzeniami</h2>
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
                <button
                  className={styles.selectGroupButton}
                  onClick={() => handleGroupSelectAllToggle(group._id)}
                >
                  {getDevicesInGroup(group._id).every(device =>
                    selectedDevices.some(d => d._id === device._id)
                  )
                    ? "Odznacz wszystkie w grupie"
                    : "Zaznacz wszystkie w grupie"}
                </button>
                <button
                  className={styles.deleteGroupButton}
                  onClick={() => handleDeleteGroup(group._id)}
                >
                  Usuń grupę
                </button>
              </div>
            </div>
            {getDevicesInGroup(group._id).length > 0 ? (
              <div className={styles.deviceGrid}>
                {getDevicesInGroup(group._id).map((device) => (
                  <div
                    key={device._id}
                    className={`${styles.deviceCard} ${
                      selectedDevices.some((d) => d._id === device._id) ? styles.selected : ""
                    }`}
                    onClick={() => handleDeviceSelectToggle(device)}
                  >
                    <div className={styles.deviceImageContainer}>
                      <div className={styles.hangingWrapper}>
                        <div className={styles.hangerBar}></div>
                        <div className={styles.stick + " " + styles.left}></div>
                        <div className={styles.stick + " " + styles.right}></div>
                        {getFileType(device.thumbnail || '') === 'video' ? (
                          <video
                            src={device.thumbnail ? `${API_BASE_URL}/${locationId}/files/${device.thumbnail}` : null}
                            autoPlay
                            loop
                            muted
                            className={styles.deviceImage}
                            onError={(e) => { e.target.onerror = null; e.target.src="/src/assets/images/device.png" }}
                          />
                        ) : (
                          <img
                            src={
                              device.thumbnail
                                ? `${API_BASE_URL}/${locationId}/files/${device.thumbnail}`
                                : "/src/assets/images/device.png"
                            }
                            alt="Device"
                            className={styles.deviceImage}
                          />
                        )}
                      </div>
                      <div className={styles.onlineIndicator}></div>
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
                            <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>Zapisz</button>
                            <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>Resetuj</button>
                            <button onClick={handleEditCancel} className={styles.cancelButton}>Anuluj</button>
                          </>
                        ) : (
                          <>
                            <h3 className={styles.deviceName}>
                              {getDisplayName(device.clientName)}
                            </h3>
                            <button onClick={() => handleEditClick(device)} className={styles.editButton}>✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); openGroupManagementModal(device); }} className={styles.editGroupButton}>👥</button>
                          </>
                        )}
                      </div>
                      <p className={styles.deviceId}>
                        Status:{" "}
                        <a style={{ color: "green", fontWeight: "bold" }}>Online</a>,
                        {device.clientId}
                      </p>
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

      {/* Devices without groups */}
      <div className={styles.groupSection}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupName}>
            Urządzenia bez grup ({getDevicesWithoutGroup().length} urządzeń)
          </h3>
          <button
            className={styles.selectGroupButton}
            onClick={() => handleGroupSelectAllToggle(null)} // Use null or a specific ID for "no group"
          >
            {getDevicesWithoutGroup().every(device =>
              selectedDevices.some(d => d._id === device._id)
            )
              ? "Odznacz wszystkie bez grupy"
              : "Zaznacz wszystkie bez grupy"}
          </button>
        </div>
        {getDevicesWithoutGroup().length > 0 ? (
          <div className={styles.deviceGrid}>
            {getDevicesWithoutGroup().map((device) => (
              <div
                key={device._id}
                className={`${styles.deviceCard} ${
                  selectedDevices.some((d) => d._id === device._id) ? styles.selected : ""
                }`}
                onClick={() => handleDeviceSelectToggle(device)}
              >
                <div className={styles.deviceImageContainer}>
                  <div className={styles.hangingWrapper}>
                    <div className={styles.hangerBar}></div>
                    <div className={styles.stick + " " + styles.left}></div>
                    <div className={styles.stick + " " + styles.right}></div>
                    {getFileType(device.thumbnail || '') === 'video' ? (
                      <video
                        src={device.thumbnail ? `${API_BASE_URL}/${locationId}/files/${device.thumbnail}` : null}
                        autoPlay
                        loop
                        muted
                        className={styles.deviceImage}
                        onError={(e) => { e.target.onerror = null; e.target.src="/src/assets/images/device.png" }}
                      />
                    ) : (
                      <img
                        src={
                          device.thumbnail
                            ? `${API_BASE_URL}/${locationId}/files/${device.thumbnail}`
                            : "/src/assets/images/device.png"
                        }
                        alt="Device"
                        className={styles.deviceImage}
                      />
                    )}
                  </div>
                  <div className={styles.onlineIndicator}></div>
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
                        <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>Zapisz</button>
                        <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>Resetuj</button>
                        <button onClick={handleEditCancel} className={styles.cancelButton}>Anuluj</button>
                      </>
                    ) : (
                      <>
                        <h3 className={styles.deviceName}>
                          {getDisplayName(device.clientName)}
                        </h3>
                        <button onClick={() => handleEditClick(device)} className={styles.editButton}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); openGroupManagementModal(device); }} className={styles.editGroupButton}>👥</button>
                      </>
                    )}
                  </div>
                  <p className={styles.deviceId}>
                    Status:{" "}
                    <a style={{ color: "green", fontWeight: "bold" }}>Online</a>,
                    {device.clientId}
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
          <button
            className={styles.manageButton}
            onClick={() => setIsModalOpen(true)}
          >
            Zarządzaj urządzeniami ({selectedDevices.length})
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
              <button className={styles.closeButton} onClick={closeUploadModal}>
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
                      <span className={styles.deviceNameInStatus}>{getDisplayName(device.clientName)}, {device.clientId}:</span> {uploadStatuses[device._id]?.message || 'Oczekuje...'}
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
                    {galleryFiles.map((filename) => {
                      const fileType = getFileType(filename);
                      const fileUrl = `${API_BASE_URL}/${locationId}/files/${filename}`;
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
                            {fileType === 'image' ? (
                              <img
                                src={fileUrl}
                                alt={filename}
                                className={styles.galleryMedia}
                              />
                            ) : fileType === 'video' ? (
                              <video
                                src={fileUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className={styles.galleryMedia}
                                onError={(e) => { e.target.onerror = null; e.target.src="/src/assets/images/placeholder-video.png"; }}
                              />
                            ) : (
                              <div className={styles.galleryPlaceholder}>
                                <span className={styles.fileIcon}>📄</span>
                              </div>
                            )}
                          </div>
                          <span className={styles.galleryFileName}>
                            {filename}{" "}
                            {fileType === 'image' && "(zdjęcie)"}
                            {fileType === 'video' && "(film)"}
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
              <button className={styles.cancelButton} onClick={closeUploadModal}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Management Modal for Individual Device */}
      {isGroupModalOpen && deviceToManageGroups && (
        <div className={styles.groupModal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Zarządzaj grupami dla {getDisplayName(deviceToManageGroups.clientName)}</h3>
              <button className={styles.closeButton} onClick={closeGroupManagementModal}>×</button>
            </div>
            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
            <div className={styles.groupListContainer}>
              <h4>Grupy, do których należy urządzenie:</h4>
              {deviceToManageGroups.groups.length > 0 ? (
                <ul className={styles.currentGroupList}>
                  {deviceToManageGroups.groups.map(groupId => {
                    const group = groups.find(g => g._id === groupId);
                    return group ? (
                      <li key={group._id}>
                        {group.name}
                        <button
                          className={styles.removeGroupButton}
                          onClick={() => handleRemoveDeviceFromGroup(group._id)}
                        >
                          Usuń
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <p>Urządzenie nie należy do żadnej grupy.</p>
              )}

              <h4>Dodaj do istniejącej grupy:</h4>
              <ul className={styles.availableGroupList}>
                {groups.length > 0 ? (
                  groups.map(group => {
                    const isAssigned = deviceToManageGroups.groups.includes(group._id);
                    return (
                      <li key={group._id}>
                        {group.name} ({group.description})
                        <button
                          className={styles.addGroupButton}
                          onClick={() => handleAddDeviceToGroup(group._id)}
                          disabled={isAssigned}
                        >
                          {isAssigned ? "Przypisano" : "Dodaj"}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <p>Brak dostępnych grup do dodania. Utwórz nową.</p>
                )}
              </ul>
            </div>

            <div className={styles.createNewGroupSection}>
              <h4>Dodaj nową grupę:</h4>
              <input
                type="text"
                placeholder="Nazwa nowej grupy"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className={styles.newGroupInput}
              />
              <textarea
                placeholder="Opis nowej grupy (opcjonalnie)"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className={styles.newGroupTextarea}
              />
              <button onClick={handleCreateNewGroup} className={styles.createGroupButton}>
                Utwórz nową grupę i dodaj do urządzenia
              </button>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelButton} onClick={closeGroupManagementModal}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Groups;