// import React, { useEffect, useState, useRef } from "react";
// import styles from "./Groups.module.css";
// import Navbar from "./Navbar";
// import editIcon from './../assets/images/edit.png';
// import groupIcon from './../assets/images/group.png';
// import { useNavigate } from "react-router-dom";

// const storedUser = localStorage.getItem("user");
// const parsedUser = storedUser ? JSON.parse(storedUser) : null;

// const storedLocationIds = (() => {
//   // preferuj klucz 'locationIds' (tablica); fallback: jeśli ktoś zostawił stary 'locationId'
//   try {
//     const arr = JSON.parse(localStorage.getItem("locationIds") || "[]");
//     if (Array.isArray(arr) && arr.length > 0) return arr;
//   } catch (_) {}
//   const legacy = localStorage.getItem("locationId");
//   return legacy ? [legacy] : (parsedUser?.locationIds || []);
// })();

// const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/locations`;

// function Groups() {
//   const [devices, setDevices] = useState([]);
//   const [groups, setGroups] = useState([]);
//   const [selectedDevices, setSelectedDevices] = useState([]);
//   const [file, setFile] = useState(null);
//   const [previewUrl, setPreviewUrl] = useState(null);
//   const [activeTab, setActiveTab] = useState("photo");
//   const [errorMsg, setErrorMsg] = useState(null);
//   const [galleryFiles, setGalleryFiles] = useState([]);
//   const [selectedGalleryFile, setSelectedGalleryFile] = useState(null);
//   const [uploadStatuses, setUploadStatuses] = useState({});
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const videoRef = useRef(null);
//   const [editingDeviceId, setEditingDeviceId] = useState(null);
//   const [editedNames, setEditedNames] = useState(() => {
//     const stored = localStorage.getItem("deviceNames");
//     return stored ? JSON.parse(stored) : {};
//   });
//   const [editInputValue, setEditInputValue] = useState("");
//   const [originalValue, setOriginalValue] = useState("");
//   const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
//   const [deviceToManageGroups, setDeviceToManageGroups] = useState(null);
//   const [newGroupName, setNewGroupName] = useState("");
//   const [newGroupDescription, setNewGroupDescription] = useState("");
//   const [selectedLocationId, setSelectedLocationId] = useState(storedLocationIds[0] || null);

//   const getDisplayName = (clientName) => {
//     return editedNames[clientName] || clientName;
//   };

//   const handleEditClick = (device) => {
//     setEditingDeviceId(device._id);
//     const currentName = editedNames[device.clientName] || "";
//     setEditInputValue(currentName);
//     setOriginalValue(currentName);
//   };

//   const handleEditSave = (clientName) => {
//     const updated = { ...editedNames, [clientName]: editInputValue };
//     setEditedNames(updated);
//     localStorage.setItem("deviceNames", JSON.stringify(updated));
//     setEditingDeviceId(null);
//     setOriginalValue("");
//   };

//   const handleEditReset = (clientName) => {
//     const updated = { ...editedNames };
//     delete updated[clientName];
//     setEditedNames(updated);
//     localStorage.setItem("deviceNames", JSON.stringify(updated));
//     setEditingDeviceId(null);
//     setOriginalValue("");
//   };

//   const handleEditCancel = () => {
//     setEditInputValue(originalValue);
//     setEditingDeviceId(null);
//     setOriginalValue("");
//   };

//   const navigate = useNavigate();

//   useEffect(() => {
//     const user = localStorage.getItem("user");
//     const parsed = user ? JSON.parse(user) : null;

//     if (!parsed || storedLocationIds.length === 0) {
//       console.warn("Brak użytkownika lub locationIds – przekierowanie do logowania.");
//       navigate("/");
//     }
//   }, []);

//   useEffect(() => {
//     if (selectedLocationId) {
//       fetchDevicesAndGroups();
//     }
//   }, [selectedLocationId]);

//   useEffect(() => {
//     if (selectedDevices.length > 0 && activeTab === "gallery" && selectedLocationId) {
//       fetchGalleryFiles();
//     }
//   }, [selectedDevices, activeTab, selectedLocationId]);

//   const fetchDevicesAndGroups = async () => {
//     if (!selectedLocationId) return;
    
//     try {
//       const [devicesRes, groupsRes] = await Promise.all([
//         fetch(`${API_BASE_URL}/${selectedLocationId}/devices`),
//         fetch(`${API_BASE_URL}/${selectedLocationId}/groups`),
//       ]);

//       const devicesData = await devicesRes.json();
//       const groupsData = await groupsRes.json();

//       // For devices without 'groups' array, initialize it as empty
//       const processedDevices = devicesData.map(device => ({
//         ...device,
//         groups: device.groups || []
//       }));

//       setDevices(processedDevices);
//       setGroups(groupsData);

//       // Initialize uploadedFiles state similarly to MainPage
//       const filesInfo = {};
//       for (const device of processedDevices) {
//         filesInfo[device._id] = {
//           photoUrl: device.photo ? `${API_BASE_URL}/${selectedLocationId}/files/${device.photo}` : null,
//           videoUrl: device.video ? `${API_BASE_URL}/${selectedLocationId}/files/${device.video}` : null,
//         };
//       }
//     } catch (err) {
//       console.error("Błąd pobierania urządzeń lub grup:", err);
//       setErrorMsg("Nie udało się załadować urządzeń lub grup.");
//     }
//   };

//   const fetchGalleryFiles = async () => {
//     if (!selectedLocationId) return;
    
//     try {
//       const res = await fetch(`${API_BASE_URL}/${selectedLocationId}/files/`);
//       if (!res.ok) {
//         throw new Error("Błąd podczas pobierania listy plików z galerii");
//       }
//       const data = await res.json();
//       setGalleryFiles(data.files);
//     } catch (err) {
//       console.error("Błąd pobierania plików galerii:", err);
//       setErrorMsg("Nie udało się załadować plików galerii.");
//     }
//   };

//   const handleDrop = (e) => {
//     e.preventDefault();
//     if (e.dataTransfer.files.length > 0) {
//       handleFile(e.dataTransfer.files[0]);
//     }
//   };

//   const handleFile = (f) => {
//     setSelectedGalleryFile(null);
//     const isImage = activeTab === "photo" && f.type.startsWith("image/");
//     const isVideo = activeTab === "video" && f.type.startsWith("video/");
//     if (isImage || isVideo) {
//       setFile(f);
//       const url = URL.createObjectURL(f);
//       setPreviewUrl(url);
//       setErrorMsg(null);
//     } else {
//       setFile(null);
//       setPreviewUrl(null);
//       setErrorMsg(
//         activeTab === "photo"
//           ? "Dozwolone tylko pliki graficzne"
//           : "Dozwolone tylko pliki wideo"
//       );
//     }
//   };

//   const handleGalleryFileSelect = (filename) => {
//     setSelectedGalleryFile(filename);
//     setFile(null);
//     setPreviewUrl(null);
//     setErrorMsg(null);
//   };

//   const handleMassUpload = async () => {
//     if (!selectedLocationId) return;
//     if (selectedDevices.length === 0) {
//       setErrorMsg("Wybierz urządzenia, dla których chcesz zaktualizować pliki.");
//       return;
//     }
//     if (!file && !selectedGalleryFile) {
//       setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
//       return;
//     }
//     setErrorMsg(null);
//     const initialStatuses = {};
//     selectedDevices.forEach(device => {
//       initialStatuses[device._id] = { status: 'pending', message: 'Oczekuje...' };
//     });
//     setUploadStatuses(initialStatuses);
//     let filenameToUse = null;
//     if (file) {
//       setUploadStatuses(prev => {
//         const newStatuses = { ...prev };
//         selectedDevices.forEach(device => {
//           newStatuses[device._id] = { status: 'uploading_file', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Wysyłanie pliku głównego...` };
//         });
//         return newStatuses;
//       });
//       const formData = new FormData();
//       formData.append("file", file);
//       try {
//         const uploadResponse = await fetch(
//           `${API_BASE_URL}/${selectedLocationId}/upload-file/`,
//           {
//             method: "POST",
//             body: formData,
//           }
//         );
//         if (!uploadResponse.ok) {
//           throw new Error("Błąd podczas przesyłania pliku");
//         }
//         const uploadResult = await uploadResponse.json();
//         filenameToUse = uploadResult.filename;
//       } catch (err) {
//         console.error("Błąd wysyłania pliku:", err);
//         setErrorMsg("Wystąpił błąd podczas przesyłania pliku: " + err.message);
//         setUploadStatuses(prev => {
//           const newStatuses = { ...prev };
//           selectedDevices.forEach(device => {
//             newStatuses[device._id] = { status: 'error', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Błąd uploadu pliku: ${err.message}` };
//           });
//           return newStatuses;
//         });
//         return;
//       }
//     } else if (selectedGalleryFile) {
//       filenameToUse = selectedGalleryFile;
//     } else {
//       setErrorMsg("Wybierz plik do wysłania lub zaznacz z galerii.");
//       return;
//     }
//     if (filenameToUse) {
//       const fileTypeActual = getFileType(filenameToUse);
//       let fieldToUpdate = null;
//       if (fileTypeActual === 'image') {
//         fieldToUpdate = 'photo';
//       } else if (fileTypeActual === 'video') {
//         fieldToUpdate = 'video';
//       } else {
//         setErrorMsg("Wybrany plik z galerii nie jest zdjęciem ani filmem i nie może zostać przypisany.");
//         return;
//       }
//       for (let i = 0; i < selectedDevices.length; i++) {
//         const device = selectedDevices[i];
//         setUploadStatuses(prev => ({
//           ...prev,
//           [device._id]: { status: 'in_progress', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Aktualizowanie...` }
//         }));
//         try {
//           // Delete existing files (photo/video)
//           await fetch(
//             `${API_BASE_URL}/${selectedLocationId}/devices/${device._id}/delete-files`,
//             { method: "DELETE" }
//           );

//           const updateFieldResponse = await fetch(
//             `${API_BASE_URL}/${selectedLocationId}/devices/${device._id}/${fieldToUpdate}`,
//             {
//               method: "PUT",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ [fieldToUpdate]: filenameToUse }),
//             }
//           );
//           if (!updateFieldResponse.ok) {
//             throw new Error(`Błąd podczas aktualizacji pola ${fieldToUpdate}`);
//           }
//           const updateChangedFlagResponse = await fetch(
//             `${API_BASE_URL}/${selectedLocationId}/devices/${device._id}/changed-true`,
//             { method: "PUT" }
//           );
//           if (!updateChangedFlagResponse.ok) {
//             throw new Error("Błąd podczas ustawiania flagi 'changed' na true");
//           }
//           const updateThumbnailResponse = await fetch(
//             `${API_BASE_URL}/${selectedLocationId}/devices/${device._id}/thumbnail`,
//             {
//               method: "PUT",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({
//                 thumbnail: filenameToUse,
//               }),
//             }
//           );
//           if (!updateThumbnailResponse.ok) {
//             throw new Error("Błąd podczas aktualizacji miniaturki urządzenia");
//           }
//           setUploadStatuses(prev => ({
//             ...prev,
//             [device._id]: { status: 'success', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Zakończono sukcesem` }
//           }));
//         } catch (err) {
//           console.error(`Błąd podczas aktualizacji urządzenia ${getDisplayName(device.clientName)}:`, err);
//           setUploadStatuses(prev => ({
//             ...prev,
//             [device._id]: { status: 'error', message: `${getDisplayName(device.clientName)}, ${device.clientId}: Błąd: ${err.message}` }
//           }));
//         }
//       }
//       fetchDevicesAndGroups(); // Re-fetch to update device list and their assigned files
//       setIsModalOpen(false);
//       setSelectedDevices([]);
//       setFile(null);
//       setPreviewUrl(null);
//       setSelectedGalleryFile(null);
//       setUploadStatuses({});
//     }
//   };

//   const closeUploadModal = () => {
//     setSelectedDevices([]);
//     setFile(null);
//     setPreviewUrl(null);
//     setErrorMsg(null);
//     setActiveTab("photo");
//     setGalleryFiles([]);
//     setSelectedGalleryFile(null);
//     setUploadStatuses({});
//     setIsModalOpen(false);
//   };

//   const formatFileSize = (bytes) => {
//     if (bytes === 0) return "0 Bytes";
//     const k = 1024;
//     const sizes = ["Bytes", "KB", "MB", "GB"];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
//   };

//   const getFileType = (filename) => {
//     const ext = filename.split('.').pop().toLowerCase();
//     if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
//       return 'image';
//     }
//     if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
//       return 'video';
//     }
//     return 'unknown';
//   };

//   const handleDeviceSelectToggle = (device) => {
//     if (!device.isOnline) return;
  
//     setSelectedDevices(prevSelected => {
//       const newSelected = prevSelected.some(d => d._id === device._id)
//         ? prevSelected.filter(d => d._id !== device._id)
//         : [...prevSelected, device];
  
//       setUploadStatuses({});
//       return newSelected;
//     });
//     setErrorMsg(null);
//   };
  

//   const handleGroupSelectAllToggle = (groupId) => {
//     const devicesInGroup = devices.filter(
//       device => device.groups.includes(groupId)
//     );
  
//     const onlineDevicesInGroup = devicesInGroup.filter(device => device.isOnline);
  
//     const allSelectedOnline = onlineDevicesInGroup.every(device =>
//       selectedDevices.some(d => d._id === device._id)
//     );
  
//     setSelectedDevices(prevSelected => {
//       let newSelected = [...prevSelected];
  
//       if (allSelectedOnline) {
//         // Odznacz wszystkie online w tej grupie
//         newSelected = newSelected.filter(device =>
//           !onlineDevicesInGroup.some(d => d._id === device._id)
//         );
//       } else {
//         // Zaznacz tylko online i niepowtórzone
//         onlineDevicesInGroup.forEach(device => {
//           if (!newSelected.some(d => d._id === device._id)) {
//             newSelected.push(device);
//           }
//         });
//       }
  
//       setUploadStatuses({});
//       return newSelected;
//     });
  
//     setErrorMsg(null);
//   };
  

//   // Group Management
//   const openGroupManagementModal = (device) => {
//     setDeviceToManageGroups(device);
//     setIsGroupModalOpen(true);
//   };

//   const closeGroupManagementModal = () => {
//     setDeviceToManageGroups(null);
//     setIsGroupModalOpen(false);
//     setNewGroupName("");
//     setNewGroupDescription("");
//   };

//   const handleAddDeviceToGroup = async (groupId) => {
//     if (!deviceToManageGroups || !selectedLocationId) return;
//     try {
//       const response = await fetch(
//         `${API_BASE_URL}/${selectedLocationId}/devices/${deviceToManageGroups._id}/groups`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ group_id: groupId }),
//         }
//       );
//       if (!response.ok) {
//         throw new Error("Błąd podczas dodawania urządzenia do grupy.");
//       }
//       await fetchDevicesAndGroups(); // Re-fetch to update UI
//       // Update deviceToManageGroups to reflect the change immediately
//       setDeviceToManageGroups(prev => ({
//         ...prev,
//         groups: [...prev.groups, groupId]
//       }));
//     } catch (err) {
//       console.error("Błąd dodawania urządzenia do grupy:", err);
//       setErrorMsg("Nie udało się dodać urządzenia do grupy.");
//     }
//   };

//   const handleRemoveDeviceFromGroup = async (groupId) => {
//     if (!deviceToManageGroups || !selectedLocationId) return;
//     try {
//       const response = await fetch(
//         `${API_BASE_URL}/${selectedLocationId}/devices/${deviceToManageGroups._id}/groups/${groupId}`,
//         {
//           method: "DELETE",
//         }
//       );
//       if (!response.ok) {
//         throw new Error("Błąd podczas usuwania grupy z urządzenia.");
//       }
//       await fetchDevicesAndGroups(); // Re-fetch to update UI
//       // Update deviceToManageGroups to reflect the change immediately
//       setDeviceToManageGroups(prev => ({
//         ...prev,
//         groups: prev.groups.filter(id => id !== groupId)
//       }));
//     } catch (err) {
//       console.error("Błąd usuwania grupy z urządzenia:", err);
//       setErrorMsg("Nie udało się usunąć grupy z urządzenia.");
//     }
//   };

//   const handleCreateNewGroup = async () => {
//     if (!newGroupName.trim() || !selectedLocationId) {
//       setErrorMsg("Nazwa nowej grupy nie może być pusta.");
//       return;
//     }
//     try {
//       const response = await fetch(`${API_BASE_URL}/${selectedLocationId}/groups`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDescription.trim() }),
//       });
//       if (!response.ok) {
//         throw new Error("Błąd podczas tworzenia nowej grupy.");
//       }
//       const newGroup = await response.json();
//       setGroups(prevGroups => [...prevGroups, newGroup]);
//       setNewGroupName("");
//       setNewGroupDescription("");
//       setErrorMsg(null); // Clear any previous errors
//       // If we're managing a device, automatically add it to the new group
//       if (deviceToManageGroups) {
//         await handleAddDeviceToGroup(newGroup._id);
//       }
//     } catch (err) {
//       console.error("Błąd tworzenia nowej grupy:", err);
//       setErrorMsg("Nie udało się stworzyć nowej grupy: " + err.message);
//     }
//   };

//   const handleDeleteGroup = async (groupId) => {
//     if (!selectedLocationId) return;
//     if (window.confirm("Czy na pewno chcesz usunąć tę grupę? Spowoduje to również usunięcie jej z przypisanych urządzeń.")) {
//       try {
//         const response = await fetch(`${API_BASE_URL}/${selectedLocationId}/groups/${groupId}`, {
//           method: "DELETE",
//         });
//         if (!response.ok) {
//           throw new Error("Błąd podczas usuwania grupy.");
//         }
//         await fetchDevicesAndGroups(); // Re-fetch all to update device group lists
//         setErrorMsg(null);
//       } catch (err) {
//         console.error("Błąd usuwania grupy:", err);
//         setErrorMsg("Nie udało się usunąć grupy: " + err.message);
//       }
//     }
//   };

//   const getDevicesInGroup = (groupId) => {
//     return devices.filter(device => device.groups.includes(groupId));
//   };

//   const getDevicesWithoutGroup = () => {
//     return devices.filter(device => device.groups.length === 0);
//   };

//   return (
//     <>
//       <Navbar />
//       <div className={styles.container}>
//         {/* Przyciski wyboru lokalizacji */}
//         {storedLocationIds.length > 1 && (
//           <div className={styles.locationSelector}>
//             <h3>Wybierz lokalizację:</h3>
//             <div className={styles.locationButtons}>
//               {storedLocationIds.map((locationId) => (
//                 <button
//                   key={locationId}
//                   className={`${styles.locationButton} ${
//                     selectedLocationId === locationId ? styles.activeLocation : ""
//                   }`}
//                   onClick={() => setSelectedLocationId(locationId)}
//                 >
//                   {locationId}
//                 </button>
//               ))}
//             </div>
//           </div>
//         )}

//         <div className={styles.header}>
//           <h2 className={styles.title}>Zarządzanie grupami i urządzeniami</h2>
//           {selectedLocationId && (
//             <p className={styles.currentLocation}>
//               Aktualna lokalizacja: {selectedLocationId === "685003cbf071eb1bb4304cd2" ? "Toronto" : 
//                                    selectedLocationId === "685003cbf071eb1bb4304cd3" ? "Montreal" : 
//                                    selectedLocationId}
//             </p>
//           )}
//           {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
//         </div>

//         {!selectedLocationId ? (
//           <div className={styles.noLocationSelected}>
//             <p>Wybierz lokalizację z powyższych przycisków, aby zobaczyć urządzenia i grupy.</p>
//           </div>
//         ) : groups.length > 0 ? (
//           groups.map((group) => (
//             <div key={group._id} className={styles.groupSection}>
//               <div className={styles.groupHeader}>
//                 <h3 className={styles.groupName}>
//                   {group.name} ({getDevicesInGroup(group._id).length} urządzeń)
//                 </h3>
//                 <div className={styles.groupActions}>
//                   <button
//                     className={styles.selectGroupButton}
//                     onClick={() => handleGroupSelectAllToggle(group._id)}
//                   >
//                     {getDevicesInGroup(group._id).every(device =>
//                       selectedDevices.some(d => d._id === device._id)
//                     )
//                       ? "Odznacz wszystkie w grupie"
//                       : "Zaznacz wszystkie w grupie"}
//                   </button>
//                   <button
//                     className={styles.deleteGroupButton}
//                     onClick={() => handleDeleteGroup(group._id)}
//                   >
//                     Usuń grupę
//                   </button>
//                 </div>
//               </div>
//               {getDevicesInGroup(group._id).length > 0 ? (
//                 <div className={styles.deviceGrid}>
//                   {getDevicesInGroup(group._id).map((device) => (
//                     <div
//                     key={device._id}
//                     className={`${styles.deviceCard} ${
//                       selectedDevices.some(d => d._id === device._id) ? styles.selected : ""
//                     } ${!device.isOnline ? styles.offline : ""}`}
//                     onClick={() => {
//                       if (device.isOnline) {
//                         handleDeviceSelectToggle(device);
//                       }
//                     }}
//                   >
                  
//                       <div className={styles.deviceIcons}>
//                         <button
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             handleEditClick(device);
//                           }}
//                           className={styles.editButton}
//                         >
//                           <img src={editIcon} alt="Edytuj" className={styles.editIcon} />
//                         </button>
//                         <button
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             openGroupManagementModal(device);
//                           }}
//                           className={styles.editGroupButton}
//                         >
//                           <img src={groupIcon} alt="Grupuj" className={styles.editIcon2} />
//                         </button>
//                       </div>

//                       <div className={styles.deviceImageContainer}>
//                         <div className={styles.hangingWrapper}>
//                           <div className={styles.hangerBar}></div>
//                           <div className={styles.stick + " " + styles.left}></div>
//                           <div className={styles.stick + " " + styles.right}></div>
//                           {getFileType(device.thumbnail || '') === 'video' ? (
//                             <video
//                               src={device.thumbnail ? `${API_BASE_URL}/${selectedLocationId}/files/${device.thumbnail}` : null}
//                               autoPlay
//                               loop
//                               muted
//                               className={styles.deviceImage}
//                               onError={(e) => { e.target.onerror = null; e.target.src = "/src/assets/images/device.png" }}
//                             />
//                           ) : (
//                             <img
//                               src={
//                                 device.thumbnail
//                                   ? `${API_BASE_URL}/${selectedLocationId}/files/${device.thumbnail}`
//                                   : "/src/assets/images/device.png"
//                               }
//                               alt="Device"
//                               className={styles.deviceImage}
//                             />
//                           )}
//                         </div>
//                         <div
//                           className={`${styles.onlineIndicator} ${device.isOnline ? styles.green : styles.red
//                             }`}
//                           title={device.isOnline ? "Online" : "Offline"}
//                         ></div>

//                       </div>

//                       {/* ▶️ INFORMACJE O URZĄDZENIU */}
//                       <div className={styles.deviceInfo}>
//                         {editingDeviceId === device._id ? (
//                           <>
//                             <input
//                               type="text"
//                               value={editInputValue}
//                               onChange={(e) => setEditInputValue(e.target.value)}
//                               className={styles.editInput}
//                             />
//                             <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>Zapisz</button>
//                             <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>Resetuj</button>
//                             <button onClick={handleEditCancel} className={styles.cancelButton}>Anuluj</button>
//                           </>
//                         ) : (
//                           <div className={styles.deviceNameEditWrapper}>
//                             <h3 className={styles.deviceName}>{getDisplayName(device.clientName)}</h3>
//                           </div>
//                         )}
//                         <p className={styles.deviceId}>
//                         Client: {device.clientId}
//                         </p>
//                       </div>
//                     </div>

//                   ))}
//                 </div>
//               ) : (
//                 <p className={styles.noDevicesMessage}>Brak urządzeń w tej grupie.</p>
//               )}
//             </div>
//           ))
//         ) : (
//           <p className={styles.noGroupsMessage}>Brak zdefiniowanych grup dla tej lokalizacji.</p>
//         )}

//         {/* Devices without groups */}
//         {selectedLocationId && (
//           <div className={styles.groupSection}>
//             <div className={styles.groupHeader}>
//               <h3 className={styles.groupName}>
//                 Urządzenia bez grup ({getDevicesWithoutGroup().length} urządzeń)
//               </h3>
//               <button
//                 className={styles.selectGroupButton}
//                 onClick={() => handleGroupSelectAllToggle(null)} // Use null or a specific ID for "no group"
//               >
//                 {getDevicesWithoutGroup().every(device =>
//                   selectedDevices.some(d => d._id === device._id)
//                 )
//                   ? "Odznacz wszystkie bez grupy"
//                   : "Zaznacz wszystkie bez grupy"}
//               </button>
//             </div>
//             {getDevicesWithoutGroup().length > 0 ? (
//               <div className={styles.deviceGrid}>
//                 {getDevicesWithoutGroup().map((device) => (
//                   <div
//                   key={device._id}
//                   className={`${styles.deviceCard} ${
//                     selectedDevices.some(d => d._id === device._id) ? styles.selected : ""
//                   } ${!device.isOnline ? styles.offline : ""}`}
//                   onClick={() => {
//                     if (device.isOnline) {
//                       handleDeviceSelectToggle(device);
//                     }
//                   }}
//                 >
                
//                     {/* 🎯 Ikony w prawym górnym rogu */}
//                     <div className={styles.deviceIcons}>
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           handleEditClick(device);
//                         }}
//                         className={styles.editButton}
//                       >
//                         <img src={editIcon} alt="Edytuj" className={styles.editIcon} />
//                       </button>
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           openGroupManagementModal(device);
//                         }}
//                         className={styles.editGroupButton}
//                       >
//                         <img src={groupIcon} alt="Grupuj" className={styles.editIcon2} />
//                       </button>
//                     </div>

//                     <div className={styles.deviceImageContainer}>
//                       <div className={styles.hangingWrapper}>
//                         <div className={styles.hangerBar}></div>
//                         <div className={`${styles.stick} ${styles.left}`}></div>
//                         <div className={`${styles.stick} ${styles.right}`}></div>
//                         {getFileType(device.thumbnail || '') === 'video' ? (
//                           <video
//                             src={
//                               device.thumbnail
//                                 ? `${API_BASE_URL}/${selectedLocationId}/files/${device.thumbnail}`
//                                 : null
//                             }
//                             autoPlay
//                             loop
//                             muted
//                             className={styles.deviceImage}
//                             onError={(e) => {
//                               e.target.onerror = null;
//                               e.target.src = "/src/assets/images/device.png";
//                             }}
//                           />
//                         ) : (
//                           <img
//                             src={
//                               device.thumbnail
//                                 ? `${API_BASE_URL}/${selectedLocationId}/files/${device.thumbnail}`
//                                 : "/src/assets/images/device.png"
//                             }
//                             alt="Device"
//                             className={styles.deviceImage}
//                           />
//                         )}
//                       </div>
//                       <div
//                         className={`${styles.onlineIndicator} ${device.isOnline ? styles.green : styles.red
//                           }`}
//                         title={device.isOnline ? "Online" : "Offline"}
//                       ></div>

//                     </div>

//                     <div className={styles.deviceInfo}>
//                       <div className={styles.deviceNameEditWrapper}>
//                         {editingDeviceId === device._id ? (
//                           <>
//                             <input
//                               type="text"
//                               value={editInputValue}
//                               onChange={(e) => setEditInputValue(e.target.value)}
//                               className={styles.editInput}
//                             />
//                             <button onClick={() => handleEditSave(device.clientName)} className={styles.saveButton}>Zapisz</button>
//                             <button onClick={() => handleEditReset(device.clientName)} className={styles.resetButton}>Resetuj</button>
//                             <button onClick={handleEditCancel} className={styles.cancelButton}>Anuluj</button>
//                           </>
//                         ) : (
//                           <h3 className={styles.deviceName}>
//                             {getDisplayName(device.clientName)}
//                           </h3>
//                         )}
//                       </div>
//                       <p className={styles.deviceId}>
//                         Status: <a style={{ color: "green", fontWeight: "bold" }}>Online</a>, {device.clientId}
//                       </p>
//                     </div>
//                   </div>
//                 ))}

//               </div>
//             ) : (
//               <p className={styles.noDevicesMessage}>Brak urządzeń bez przypisanych grup.</p>
//             )}
//           </div>
//         )}

//         {selectedDevices.length > 0 && (
//           <div className={styles.manageButtonContainer}>
//             <button
//               className={styles.manageButton}
//               onClick={() => setIsModalOpen(true)}
//             >
//               Zarządzaj urządzeniami ({selectedDevices.length})
//             </button>
//           </div>
//         )}

//         {isModalOpen && (
//           <div className={styles.uploadModal}>
//             <div className={styles.modalContent}>
//               <div className={styles.modalHeader}>
//                 <h3 className={styles.modalTitle}>
//                   Załaduj {activeTab === "photo" ? "zdjęcie" : (activeTab === "video" ? "film" : "plik")} dla wybranych urządzeń
//                 </h3>
//                 <button className={styles.closeButton} onClick={closeUploadModal}>
//                   ×
//                 </button>
//               </div>
//               <div className={styles.tabSwitcher}>
//                 <button
//                   className={`${styles.tab} ${activeTab === "photo" ? styles.activeTab : ""
//                     }`}
//                   onClick={() => {
//                     setActiveTab("photo");
//                     setFile(null);
//                     setPreviewUrl(null);
//                     setSelectedGalleryFile(null);
//                   }}
//                 >
//                   Zdjęcie
//                 </button>
//                 <button
//                   className={`${styles.tab} ${activeTab === "video" ? styles.activeTab : ""
//                     }`}
//                   onClick={() => {
//                     setActiveTab("video");
//                     setFile(null);
//                     setPreviewUrl(null);
//                     setSelectedGalleryFile(null);
//                   }}
//                 >
//                   Film
//                 </button>
//                 <button
//                   className={`${styles.tab} ${activeTab === "gallery" ? styles.activeTab : ""
//                     }`}
//                   onClick={() => {
//                     setActiveTab("gallery");
//                     setFile(null);
//                     setPreviewUrl(null);
//                   }}
//                 >
//                   Galeria plików
//                 </button>
//               </div>
//               {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
//               {Object.keys(uploadStatuses).length > 0 && (
//                 <div className={styles.uploadStatusContainer}>
//                   <h4>Statusy operacji:</h4>
//                   <ul className={styles.uploadStatusList}>
//                     {selectedDevices.map(device => (
//                       <li key={device._id} className={`${styles.modalUploadStatusItem} ${styles[uploadStatuses[device._id]?.status || 'pending']}`}>
//                         <span className={styles.deviceNameInStatus}>{getDisplayName(device.clientName)}, {device.clientId}:</span> {uploadStatuses[device._id]?.message || 'Oczekuje...'}
//                       </li>
//                     ))}
//                   </ul>
//                 </div>
//               )}
//               {activeTab !== "gallery" ? (
//                 <div
//                   className={`${styles.dropZone} ${file ? styles.hasFile : ""}`}
//                   onDragOver={(e) => e.preventDefault()}
//                   onDrop={handleDrop}
//                 >
//                   {previewUrl ? (
//                     <div className={styles.previewContainer}>
//                       {activeTab === "photo" ? (
//                         <img
//                           src={previewUrl}
//                           alt="Preview"
//                           className={styles.previewImage}
//                         />
//                       ) : (
//                         <>
//                           <video
//                             src={previewUrl}
//                             controls
//                             ref={videoRef}
//                             className={styles.previewImage}
//                           />
//                         </>
//                       )}
//                       <div className={styles.fileInfo}>
//                         <span className={styles.fileName}>{file.name}</span>
//                         <span className={styles.fileSize}>
//                           {formatFileSize(file.size)}
//                         </span>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className={styles.dropZoneContent}>
//                       <div className={styles.uploadIcon}>📁</div>
//                       <p className={styles.dropText}>
//                         Przeciągnij i upuść plik{" "}
//                         {activeTab === "photo" ? "graficzny" : "wideo"} tutaj
//                       </p>
//                       <p className={styles.dropSubtext}>lub</p>
//                     </div>
//                   )}
//                   <input
//                     type="file"
//                     accept={activeTab === "photo" ? "image/*" : "video/*"}
//                     onChange={(e) =>
//                       e.target.files.length > 0 && handleFile(e.target.files[0])
//                     }
//                     className={styles.fileInput}
//                   />
//                 </div>
//               ) : (
//                 <div className={styles.galleryContainer}>
//                   {galleryFiles.length > 0 ? (
//                     <div className={styles.fileGrid}>
//                       {galleryFiles.map((filename) => {
//                         const fileType = getFileType(filename);
//                         const fileUrl = `${API_BASE_URL}/${selectedLocationId}/files/${filename}`;
//                         return (
//                           <label
//                             key={filename}
//                             className={`${styles.galleryItem} ${selectedGalleryFile === filename ? styles.selectedGalleryItem : ""
//                               }`}
//                           >
//                             <input
//                               type="radio"
//                               name="galleryFile"
//                               value={filename}
//                               checked={selectedGalleryFile === filename}
//                               onChange={() => handleGalleryFileSelect(filename)}
//                               className={styles.galleryRadioButton}
//                             />
//                             <div className={styles.galleryMediaWrapper}>
//                               {fileType === 'image' ? (
//                                 <img
//                                   src={fileUrl}
//                                   alt={filename}
//                                   className={styles.galleryMedia}
//                                 />
//                               ) : fileType === 'video' ? (
//                                 <video
//                                   src={fileUrl}
//                                   autoPlay
//                                   loop
//                                   muted
//                                   playsInline
//                                   className={styles.galleryMedia}
//                                   onError={(e) => { e.target.onerror = null; e.target.src = "/src/assets/images/placeholder-video.png"; }}
//                                 />
//                               ) : (
//                                 <div className={styles.galleryPlaceholder}>
//                                   <span className={styles.fileIcon}>📄</span>
//                                 </div>
//                               )}
//                             </div>
//                             <span className={styles.galleryFileName}>
//                               {filename}{" "}
//                               {fileType === 'image' && "(zdjęcie)"}
//                               {fileType === 'video' && "(film)"}
//                             </span>
//                           </label>
//                         );
//                       })}
//                     </div>
//                   ) : (
//                     <p>Brak plików w galerii dla tej lokalizacji.</p>
//                   )}
//                 </div>
//               )}
//               <div className={styles.modalActions}>
//                 <button
//                   className={styles.uploadButton}
//                   onClick={handleMassUpload}
//                   disabled={!(file || selectedGalleryFile) || selectedDevices.length === 0}
//                 >
//                   {activeTab === "gallery" ? "Wybierz plik" : "Wyślij plik"} dla {selectedDevices.length} urządzeń
//                 </button>
//                 <button className={styles.cancelButton} onClick={closeUploadModal}>
//                   Anuluj
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Group Management Modal for Individual Device */}
//         {isGroupModalOpen && deviceToManageGroups && (
//           <div className={styles.groupModal}>
//             <div className={styles.modalContent}>
//               <div className={styles.modalHeader}>
//                 <h3 className={styles.modalTitle}>Zarządzaj grupami dla {getDisplayName(deviceToManageGroups.clientName)}</h3>
//                 <button className={styles.closeButton} onClick={closeGroupManagementModal}>×</button>
//               </div>
//               {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
//               <div className={styles.groupListContainer}>
//                 <h4>Grupy, do których należy urządzenie:</h4>
//                 {deviceToManageGroups.groups.length > 0 ? (
//                   <ul className={styles.currentGroupList}>
//                     {deviceToManageGroups.groups.map(groupId => {
//                       const group = groups.find(g => g._id === groupId);
//                       return group ? (
//                         <li key={group._id} className={styles.groupListItem}>
//                           <span className={styles.groupNameInList}>{group.name}</span>
//                           <div className={styles.groupListItemActions}>
//                             <button
//                               className={styles.removeGroupButton}
//                               onClick={() => handleRemoveDeviceFromGroup(group._id)}
//                             >
//                               Usuń
//                             </button>
//                           </div>
//                         </li>

//                       ) : null;
//                     })}
//                   </ul>
//                 ) : (
//                   <p>Urządzenie nie należy do żadnej grupy.</p>
//                 )}

//                 <h4>Dodaj do istniejącej grupy:</h4>
//                 <ul className={styles.availableGroupList}>
//                   {groups.length > 0 ? (
//                     groups.map(group => {
//                       const isAssigned = deviceToManageGroups.groups.includes(group._id);
//                       return (
//                         <li key={group._id} className={styles.groupListItem}>
//                           <div className={styles.groupNameInList}>
//                             {group.name}
//                             {group.description && (
//                               <span className={styles.groupDescriptionInList}> ({group.description})</span>
//                             )}
//                           </div>

//                           <div className={styles.groupListItemActions}>
//                             <button
//                               className={styles.addGroupButton}
//                               onClick={() => handleAddDeviceToGroup(group._id)}
//                               disabled={isAssigned}
//                             >
//                               {isAssigned ? "Przypisano" : "Dodaj"}
//                             </button>
//                           </div>
//                         </li>

//                       );
//                     })
//                   ) : (
//                     <p>Brak dostępnych grup do dodania. Utwórz nową.</p>
//                   )}
//                 </ul>
//               </div>

//               <div className={styles.createNewGroupSection}>
//                 <h4>Dodaj nową grupę:</h4>
//                 <input
//                   type="text"
//                   placeholder="Nazwa nowej grupy"
//                   value={newGroupName}
//                   onChange={(e) => setNewGroupName(e.target.value)}
//                   className={styles.newGroupInput}
//                 />
//                 <textarea
//                   placeholder="Opis nowej grupy (opcjonalnie)"
//                   value={newGroupDescription}
//                   onChange={(e) => setNewGroupDescription(e.target.value)}
//                   className={styles.newGroupTextarea}
//                 />
//                 <button onClick={handleCreateNewGroup} className={styles.createGroupButton}>
//                   Utwórz nową grupę i dodaj do urządzenia
//                 </button>
//               </div>

//               <div className={styles.modalActions}>
//                 <button className={styles.cancelButton} onClick={closeGroupManagementModal}>
//                   Zamknij
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </>
//   );
// }

// export default Groups;



import React, { useEffect, useRef, useState } from "react";
import styles from "./Settings.module.css";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";

const API_ROOT = import.meta.env.VITE_BACKEND_URL;
const API_PRICEUSERS = `${API_ROOT}/api/priceusers`;
const API_LOCATIONS = `${API_ROOT}/api/locations`;

export default function Settings() {
  const navigate = useNavigate();

  // --- User / Navbar visibility ---
  const [user, setUser] = useState(null);
  const hasAnyLocation = (user?.locationIds?.length || 0) > 0;

  // --- 2FA state ---
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [otpauthUri, setOtpauthUri] = useState(null);
  const [otp, setOtp] = useState("");
  const [testResult, setTestResult] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- Simple profile fields ---
  const [firstName, setFirstName] = useState("");
  const [firstNameSaving, setFirstNameSaving] = useState(false);
  const [firstNameMsg, setFirstNameMsg] = useState("");

  const [lastName, setLastName] = useState("");
  const [lastNameSaving, setLastNameSaving] = useState(false);
  const [lastNameMsg, setLastNameMsg] = useState("");

  const [locationName, setLocationName] = useState("");
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  // --- Email change ---
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmail2, setNewEmail2] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // --- Password change ---
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  // --- Locations (moved from AddLocation) ---
  const token = localStorage.getItem("token");
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [allLocationIds, setAllLocationIds] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [locMessage, setLocMessage] = useState("");

  // QR scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const detectorRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Init ---
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/");
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
    setTotpEnabled(!!parsed.totp_enabled);

    setFirstName(parsed.first_name || "");
    setLastName(parsed.last_name || "");
    setLocationName(parsed.locationName || "");
    setOldEmail(parsed.email || "");

    // load locations
    if (parsed?._id) {
      fetchAssignedLocations(parsed._id, parsed.locationIds || []);
    }
    loadAllLocations();

    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // --- Helpers ---
  async function fetchJson(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data?.detail || "Wystąpił błąd.";
      throw new Error(msg);
    }
    return data;
  }

  async function verifyCredentialsWithOptionalOtp(pwdPlain, maybeOtp) {
    try {
      const payload = {
        email: user.email,
        password: pwdPlain,
      };
      if (maybeOtp?.trim()) payload.otp = maybeOtp.trim();

      const res = await fetch(`${API_PRICEUSERS}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };

      if (data?.detail === "OTP_REQUIRED") {
        return { ok: false, otpRequired: true, message: "Wymagany kod OTP." };
      }
      if (data?.detail === "INVALID_OTP") {
        return { ok: false, invalidOtp: true, message: "Niepoprawny kod OTP." };
      }
      return { ok: false, message: data?.detail || "Niepoprawne dane logowania." };
    } catch (e) {
      return { ok: false, message: e.message || "Błąd weryfikacji hasła." };
    }
  }

  async function refreshUser() {
    try {
      if (!user?._id) return;
      setLoadingRefresh(true);
      const res = await fetch(`${API_PRICEUSERS}/${user._id}`);
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setTotpEnabled(!!data.totp_enabled);
        localStorage.setItem("user", JSON.stringify(data));
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setLocationName(data.locationName || "");
        setOldEmail(data.email || "");
        // refresh assigned locations
        await fetchAssignedLocations(data._id, data.locationIds || []);
      } else {
        throw new Error(data?.detail || "Nie udało się odświeżyć użytkownika.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingRefresh(false);
    }
  }

  // --- 2FA handlers ---
  async function handleEnable2FA(e) {
    e.preventDefault();
    setErrorMsg("");
    setTestResult("");
    setQrDataUrl(null);
    setSecret(null);
    setOtpauthUri(null);

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password) return setErrorMsg("Podaj hasło, aby potwierdzić.");

    try {
      setLoadingSetup(true);
      const res = await fetch(`${API_PRICEUSERS}/totp/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Nie udało się włączyć 2FA.");
      setQrDataUrl(data.qr_data_url);
      setSecret(data.secret);
      setOtpauthUri(data.otpauth_uri);
      await refreshUser();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingSetup(false);
    }
  }

  async function handleDisable2FA() {
    setErrorMsg("");
    setTestResult("");
    setQrDataUrl(null);
    setSecret(null);
    setOtpauthUri(null);

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password) return setErrorMsg("Podaj hasło, aby potwierdzić.");

    try {
      setLoadingDisable(true);
      const res = await fetch(`${API_PRICEUSERS}/totp/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Nie udało się wyłączyć 2FA.");
      await refreshUser();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingDisable(false);
    }
  }

  async function handleTestOtp(e) {
    e.preventDefault();
    setErrorMsg("");
    setTestResult("");

    if (!user?.email) return setErrorMsg("Brak emaila użytkownika w sesji.");
    if (!password || !otp) return setErrorMsg("Podaj hasło i kod z aplikacji.");

    try {
      const res = await fetch(`${API_PRICEUSERS}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: password,
          otp: otp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.detail === "INVALID_OTP") return setTestResult("❌ Kod niepoprawny.");
        if (data?.detail === "OTP_REQUIRED") return setTestResult("Włączone 2FA – wprowadź kod i spróbuj ponownie.");
        throw new Error(data?.detail || "Błąd podczas testu OTP.");
      }
      setTestResult("✅ Kod poprawny (logowanie OK).");
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  // --- Save simple fields ---
  async function saveFirstName() {
    if (!firstName.trim()) return setFirstNameMsg("Podaj imię.");
    if (!user?._id) return;
    try {
      setFirstNameSaving(true);
      setFirstNameMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/first-name`, {
        method: "PATCH",
        body: JSON.stringify({ first_name: firstName.trim() }),
      });
      setFirstNameMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setFirstNameMsg(`❌ ${e.message}`);
    } finally {
      setFirstNameSaving(false);
    }
  }

  async function saveLastName() {
    if (!lastName.trim()) return setLastNameMsg("Podaj nazwisko.");
    if (!user?._id) return;
    try {
      setLastNameSaving(true);
      setLastNameMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/last-name`, {
        method: "PATCH",
        body: JSON.stringify({ last_name: lastName.trim() }),
      });
      setLastNameMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setLastNameMsg(`❌ ${e.message}`);
    } finally {
      setLastNameSaving(false);
    }
  }

  async function saveLocationName() {
    if (!locationName.trim()) return setLocationMsg("Podaj nazwę lokalizacji.");
    if (!user?._id) return;
    try {
      setLocationSaving(true);
      setLocationMsg("");
      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/location-name`, {
        method: "PATCH",
        body: JSON.stringify({ locationName: locationName.trim() }),
      });
      setLocationMsg("✅ Zapisano.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (e) {
      setLocationMsg(`❌ ${e.message}`);
    } finally {
      setLocationSaving(false);
    }
  }

  // --- Save EMAIL ---
  async function saveEmail() {
    setEmailMsg("");
    if (!user?._id) return;

    if (!oldEmail.trim()) return setEmailMsg("Podaj obecny email.");
    if (oldEmail.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
      return setEmailMsg("Obecny email nie zgadza się z zapisanym.");
    }
    if (!newEmail.trim() || !newEmail2.trim()) {
      return setEmailMsg("Podaj nowy email dwa razy.");
    }
    if (newEmail.trim().toLowerCase() !== newEmail2.trim().toLowerCase()) {
      return setEmailMsg("Nowe emaile nie są takie same.");
    }
    if (!emailPwd.trim()) {
      return setEmailMsg("Podaj obecne hasło.");
    }

    try {
      setEmailSaving(true);

      const v = await verifyCredentialsWithOptionalOtp(emailPwd, emailOtp);
      if (!v.ok) {
        if (v.otpRequired) return setEmailMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setEmailMsg("Niepoprawny kod OTP.");
        return setEmailMsg(v.message || "Weryfikacja nieudana.");
      }

      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/email`, {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      });

      setEmailMsg("✅ Email zmieniony.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setNewEmail("");
      setNewEmail2("");
      setEmailPwd("");
      setEmailOtp("");
    } catch (e) {
      setEmailMsg(`❌ ${e.message}`);
    } finally {
      setEmailSaving(false);
    }
  }

  // --- Save PASSWORD ---
  async function savePassword() {
    setPwdMsg("");
    if (!user?._id) return;

    if (!oldPwd) return setPwdMsg("Podaj obecne hasło.");
    if (!newPwd || !newPwd2) return setPwdMsg("Podaj nowe hasło dwa razy.");
    if (newPwd.length < 8 || newPwd2.length < 8) {
      return setPwdMsg("Nowe hasło musi mieć co najmniej 8 znaków.");
    }
    if (newPwd !== newPwd2) return setPwdMsg("Nowe hasła nie są takie same.");

    try {
      setPwdSaving(true);

      const v = await verifyCredentialsWithOptionalOtp(oldPwd, pwdOtp);
      if (!v.ok) {
        if (v.otpRequired) return setPwdMsg("Włączone 2FA — podaj kod OTP i spróbuj ponownie.");
        if (v.invalidOtp) return setPwdMsg("Niepoprawny kod OTP.");
        return setPwdMsg(v.message || "Weryfikacja nieudana.");
      }

      const data = await fetchJson(`${API_PRICEUSERS}/${user._id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPwd }),
      });

      setPwdMsg("✅ Hasło zmienione.");
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setOldPwd("");
      setNewPwd("");
      setNewPwd2("");
      setPwdOtp("");
    } catch (e) {
      setPwdMsg(`❌ ${e.message}`);
    } finally {
      setPwdSaving(false);
    }
  }

  // =========================
  // Locations (merged AddLocation)
  // =========================
  async function loadAllLocations() {
    try {
      const res = await fetch(`${API_LOCATIONS}`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = Array.isArray(data) ? data.map(l => l._id || l.id).filter(Boolean) : [];
      setAllLocationIds(ids);
    } catch (e) {
      console.error("Nie udało się pobrać wszystkich lokalizacji:", e);
    }
  }

  async function fetchAssignedLocations(userId, locationIdsArr) {
    try {
      const res = await fetch(`${API_PRICEUSERS}/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Błąd pobierania użytkownika");
      const data = await res.json();

      const ids = Array.isArray(data.locationIds) ? data.locationIds : (locationIdsArr || []);
      if (Array.isArray(ids)) {
        const locations = await Promise.all(
          ids.map(async (locId) => {
            const resp = await fetch(`${API_LOCATIONS}/${locId}`);
            return resp.ok
              ? await resp.json()
              : { _id: locId, name: "?", address: "?", error: "Nie znaleziono w bazie" };
          })
        );
        setAssignedLocations(locations);
      } else {
        setAssignedLocations([]);
      }
    } catch (err) {
      console.error(err);
      setAssignedLocations([]);
    }
  }

  async function handleAddLocation() {
    if (!locationId.trim() || !user?._id) return;
    try {
      const resp = await fetch(`${API_LOCATIONS}/${locationId}`);
      if (!resp.ok) {
        setLocMessage("❌ Lokalizacja nie istnieje w bazie");
        return;
      }
      const location = await resp.json();
      const updatedLocationIds = [...new Set([...(user.locationIds || []), locationId])];

      const res = await fetch(`${API_PRICEUSERS}/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd aktualizacji użytkownika");

      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations((prev) => [...prev, location]);
      setLocationId("");
      setLocMessage("✅ Lokalizacja dodana do użytkownika");
      loadAllLocations();
    } catch (err) {
      console.error(err);
      setLocMessage("❌ Błąd podczas dodawania lokalizacji");
    }
  }

  async function handleRemove(locId) {
    if (!user?._id) return;
    try {
      const updatedLocationIds = (user.locationIds || []).filter((id) => id !== locId);
      const res = await fetch(`${API_PRICEUSERS}/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ locationIds: updatedLocationIds }),
      });
      if (!res.ok) throw new Error("Błąd usuwania lokalizacji");

      const nextUser = { ...user, locationIds: updatedLocationIds };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      setAssignedLocations((list) => list.filter((l) => l._id !== locId));
      loadAllLocations();
    } catch (err) {
      console.error(err);
    }
  }

  function handleUpdateLocation(locId, field, value) {
    setAssignedLocations((list) =>
      list.map((loc) => (loc._id === locId ? { ...loc, [field]: value, dirty: true } : loc))
    );
  }

  async function handleSaveLocation(loc) {
    try {
      const res = await fetch(`${API_LOCATIONS}/${loc._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: loc.name, address: loc.address }),
      });
      if (!res.ok) throw new Error("Błąd zapisu lokalizacji");
      setAssignedLocations((list) =>
        list.map((l) => (l._id === loc._id ? { ...loc, dirty: false } : l))
      );
      setLocMessage("✅ Zapisano zmiany lokalizacji");
    } catch (err) {
      console.error(err);
      setLocMessage("❌ Błąd zapisu lokalizacji");
    }
  }

  // --- QR scanner helpers ---
  async function openScanner() {
    setScanError("");
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setScanError(
        "Kamera wymaga bezpiecznego połączenia. Otwórz stronę przez HTTPS lub na localhost. " +
          "Alternatywnie użyj przycisku 'Wczytaj zdjęcie' i zeskanuj QR ze zdjęcia."
      );
      setShowScanner(true);
      return;
    }

    setShowScanner(true);
    try {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
        throw new Error("API kamery niedostępne. Spróbuj przez HTTPS lub na localhost.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ("BarcodeDetector" in window) {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        scanLoopWithDetector();
      } else {
        throw new Error(
          "Brak wsparcia BarcodeDetector. Użyj przycisku 'Wczytaj zdjęcie' i zeskanuj QR ze zdjęcia."
        );
      }
    } catch (err) {
      console.error(err);
      setScanError(err.message || "Nie udało się uruchomić kamery.");
    }
  }

  function scanLoopWithDetector() {
    const tick = async () => {
      if (!detectorRef.current || !videoRef.current) return;
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        const qr = Array.isArray(codes) ? codes.find((c) => c.rawValue) : null;
        if (qr?.rawValue) {
          setLocationId(qr.rawValue.trim());
          stopScanner();
          setShowScanner(false);
          setLocMessage("📥 Wklejono wynik QR do pola.");
          return;
        }
      } catch {}
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopScanner() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }

  function closeScanner() {
    stopScanner();
    setShowScanner(false);
  }

  function pickImageForScan() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  async function onPickedImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!("BarcodeDetector" in window)) {
      setScanError("Brak wsparcia BarcodeDetector – zaktualizuj przeglądarkę.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      const qr = Array.isArray(codes) ? codes.find((c) => c.rawValue) : null;
      if (qr?.rawValue) {
        setLocationId(qr.rawValue.trim());
        setShowScanner(false);
        setLocMessage("📥 Wklejono wynik QR ze zdjęcia.");
      } else {
        setScanError("Nie udało się odczytać kodu QR ze zdjęcia.");
      }
    } catch (err) {
      console.error(err);
      setScanError("Błąd podczas analizy zdjęcia.");
    }
  }

  if (!user) return null;

  return (
    <div className={styles.container}>
      {hasAnyLocation && <Navbar />}

      <div className={styles.inner}>
        <h1>Ustawienia konta</h1>

        {/* Dane profilu */}
        <section className={styles.card}>
          <h2>Dane profilu</h2>

          <div className={styles.row}>
            <label>Imię</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Imię"
              />
              <button className={styles.secondary} onClick={saveFirstName} disabled={firstNameSaving}>
                {firstNameSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {firstNameMsg && <div className={styles.noteLine}>{firstNameMsg}</div>}
          </div>

          <div className={styles.row}>
            <label>Nazwisko</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nazwisko"
              />
              <button className={styles.secondary} onClick={saveLastName} disabled={lastNameSaving}>
                {lastNameSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {lastNameMsg && <div className={styles.noteLine}>{lastNameMsg}</div>}
          </div>

          <div className={styles.row}>
            <label>Nazwa lokalizacji</label>
            <div className={styles.growRow}>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="np. Toronto"
              />
              <button className={styles.secondary} onClick={saveLocationName} disabled={locationSaving}>
                {locationSaving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
            {locationMsg && <div className={styles.noteLine}>{locationMsg}</div>}
          </div>
        </section>

        {/* Zmiana emaila */}
        <section className={styles.card}>
          <h2>Zmiana emaila</h2>

          <div className={styles.row}>
            <label>Obecny email</label>
            <input
              type="email"
              value={oldEmail}
              onChange={(e) => setOldEmail(e.target.value)}
              placeholder="obecny@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Nowy email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nowy@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Powtórz nowy email</label>
            <input
              type="email"
              value={newEmail2}
              onChange={(e) => setNewEmail2(e.target.value)}
              placeholder="nowy@email.com"
            />
          </div>

          <div className={styles.row}>
            <label>Obecne hasło</label>
            <input
              type="password"
              value={emailPwd}
              onChange={(e) => setEmailPwd(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {totpEnabled && (
            <div className={styles.row}>
              <label>Kod OTP (2FA)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
          )}

          <button className={styles.primary} onClick={saveEmail} disabled={emailSaving}>
            {emailSaving ? "Zapisywanie…" : "Zapisz email"}
          </button>

          {emailMsg && (
            <div className={styles.messages}>
              <p className={emailMsg.startsWith("✅") ? styles.info : styles.error}>{emailMsg}</p>
            </div>
          )}
        </section>

        {/* Zmiana hasła */}
        <section className={styles.card}>
          <h2>Zmiana hasła</h2>

          <div className={styles.row}>
            <label>Obecne hasło</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.row}>
            <label>Nowe hasło</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="min. 8 znaków"
              autoComplete="new-password"
            />
          </div>

          <div className={styles.row}>
            <label>Powtórz nowe hasło</label>
            <input
              type="password"
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              placeholder="powtórz nowe hasło"
              autoComplete="new-password"
            />
          </div>

          {totpEnabled && (
            <div className={styles.row}>
              <label>Kod OTP (2FA)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={pwdOtp}
                onChange={(e) => setPwdOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
          )}

          <button className={styles.primary} onClick={savePassword} disabled={pwdSaving}>
            {pwdSaving ? "Zapisywanie…" : "Zapisz hasło"}
          </button>

          {pwdMsg && (
            <div className={styles.messages}>
              <p className={pwdMsg.startsWith("✅") ? styles.info : styles.error}>{pwdMsg}</p>
            </div>
          )}
        </section>

        {/* 2FA */}
        <section className={styles.card}>
          <h2>Dwuskładnikowe uwierzytelnianie (2FA)</h2>
          <p className={styles.note}>
            Użyj aplikacji <strong>Google Authenticator</strong> (lub Microsoft Authenticator / FreeOTP), aby
            generować jednorazowe kody.
          </p>

          <div className={styles.row}>
            <div>
              <b>Status:</b>
            </div>
            <div>{totpEnabled ? "Włączone" : "Wyłączone"}</div>
          </div>

          <div className={styles.row}>
            <label htmlFor="pwd">Hasło do potwierdzenia:</label>
            <input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {!totpEnabled ? (
            <button className={styles.primary} onClick={handleEnable2FA} disabled={loadingSetup}>
              {loadingSetup ? "Włączanie…" : "Włącz 2FA i pobierz QR"}
            </button>
          ) : (
            <button className={styles.danger} onClick={handleDisable2FA} disabled={loadingDisable}>
              {loadingDisable ? "Wyłączanie…" : "Wyłącz 2FA"}
            </button>
          )}

          {qrDataUrl && (
            <div className={styles.qrBlock}>
              <h3>Zeskanuj ten kod w aplikacji</h3>
              <img src={qrDataUrl} alt="QR do konfiguracji TOTP" className={styles.qr} />
              <div className={styles.secretRow}>
                <div>
                  <div>
                    <b>Sekret (jeśli nie można skanować QR):</b>
                  </div>
                  <code className={styles.secret}>{secret}</code>
                </div>
              </div>
            </div>
          )}

          {totpEnabled && (
            <form onSubmit={handleTestOtp} className={styles.testForm}>
              <h3>Przetestuj kod</h3>
              <div className={styles.row}>
                <label htmlFor="otp">Kod z aplikacji:</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <button className={styles.secondary} type="submit">
                Sprawdź kod
              </button>
            </form>
          )}

          {(errorMsg || testResult) && (
            <div className={styles.messages}>
              {errorMsg && <p className={styles.error}>{errorMsg}</p>}
              {testResult && <p className={styles.info}>{testResult}</p>}
            </div>
          )}

          <div className={styles.tools}>
            <button className={styles.linkBtn} onClick={refreshUser} disabled={loadingRefresh}>
              {loadingRefresh ? "Odświeżanie…" : "Odśwież dane użytkownika"}
            </button>
          </div>
        </section>

        {/* ======= DODAWANIE LOKALIZACJI (scalone AddLocation) ======= */}
        <section className={styles.card}>
          <h2>Dodaj lokalizację</h2>
          <div className={styles.growRow}>
            <input
              type="text"
              placeholder="Wpisz ID lokalizacji"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            />
            <button className={styles.primary} onClick={handleAddLocation}>
              Dodaj
            </button>
            <button type="button" className={styles.secondary} title="Zeskanuj QR" onClick={openScanner}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          {locMessage && <p className={styles.info}>{locMessage}</p>}
        </section>

        <section className={styles.card}>
          <h3>Twoje lokalizacje</h3>
          {assignedLocations.length === 0 ? (
            <p className={styles.note}>Brak przypisanych lokalizacji.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nazwa</th>
                  <th>Adres</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {assignedLocations.map((loc) => (
                  <tr key={loc._id}>
                    <td>
                      <code>{loc._id}</code>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={loc.name || ""}
                        onChange={(e) => handleUpdateLocation(loc._id, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={loc.address || ""}
                        onChange={(e) => handleUpdateLocation(loc._id, "address", e.target.value)}
                      />
                    </td>
                    <td className={styles.actions}>
                      <button className={styles.primary} onClick={() => handleSaveLocation(loc)}>
                        Zapisz
                      </button>
                      <button className={styles.danger} onClick={() => handleRemove(loc._id)}>
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Modal skanera (QR) */}
      {showScanner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "min(90vw, 480px)",
              aspectRatio: "1 / 1",
              background: "#000",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.3)",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 16,
                border: "2px dashed rgba(255,255,255,0.7)",
                borderRadius: 10,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#fff",
                fontWeight: 600,
                textShadow: "0 1px 2px rgba(0,0,0,.6)",
              }}
            >
              <span>Skieruj aparat na kod QR</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={pickImageForScan}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Wczytaj zdjęcie
                </button>
                <button
                  onClick={closeScanner}
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>

            {scanError && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  right: 8,
                  color: "#fee2e2",
                  background: "rgba(239,68,68,0.25)",
                  border: "1px solid rgba(239,68,68,0.55)",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                {scanError}
              </div>
            )}
          </div>

          {/* ukryty input do fallbacku */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={onPickedImage}
          />
        </div>
      )}
    </div>
  );
}
