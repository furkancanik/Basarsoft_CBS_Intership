import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import AdminPage from "./pages/AdminPage";

function App() {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={token ? <Navigate to="/map" /> : <Navigate to="/login" />}
        />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/map"
          element={token ? <MapPage /> : <Navigate to="/login" />}
        />

        <Route
          path="/admin"
          element={token ? <AdminPage /> : <Navigate to="/login" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;