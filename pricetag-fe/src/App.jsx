import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./components/MainPage";
import ManageMultipleDevices from "./components/ManageMultipleDevices";

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/all" element={<ManageMultipleDevices />} />
      </Routes>
    </Router>
  );
}

export default App;
