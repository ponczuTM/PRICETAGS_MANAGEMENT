import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./components/MainPage";
import Groups from "./components/Groups";
import Schedule from "./components/Schedule";
import Gallery from "./components/Gallery";
import Login from "./components/Login";
import Register from "./components/Register";

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/mainpage" element={<MainPage />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
