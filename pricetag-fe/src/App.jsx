import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./components/MainPage";
import Groups from "./components/Groups";
import Schedule from "./components/Schedule";

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/schedule" element={<Schedule />} />
      </Routes>
    </Router>
  );
}

export default App;
