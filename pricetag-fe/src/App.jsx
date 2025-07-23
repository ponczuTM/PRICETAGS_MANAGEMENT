import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./components/MainPage";
import Groups from "./components/Groups";

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/groups" element={<Groups />} />
      </Routes>
    </Router>
  );
}

export default App;
