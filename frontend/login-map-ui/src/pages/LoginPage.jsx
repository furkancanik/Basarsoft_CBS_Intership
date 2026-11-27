import { useState } from "react";
import axios from "axios";
import "./LoginPage.css";
import logo from "../assets/basarsoftlogo.png";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5075";

function LoginPage() {
  // "login" veya "register"
  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setMessage("");
    setSuccessMessage("");
  };

  const login = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password,
      });

      localStorage.setItem("token", response.data.token);

      window.location.href = "/map";
    } catch (error) {
      console.log(error);
      setMessage("Kullanıcı adı veya şifre hatalı");
    }
  };

  const register = async () => {
    if (username.trim().length < 3) {
      setMessage("Kullanıcı adı en az 3 karakter olmalı");
      return;
    }

    if (password.trim().length < 6) {
      setMessage("Şifre en az 6 karakter olmalı");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Şifreler eşleşmiyor");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username,
        password,
      });

      const createdUsername = username;

      switchMode("login");
      setUsername(createdUsername);
      setSuccessMessage("Hesabın oluşturuldu, şimdi giriş yapabilirsin");
    } catch (error) {
      console.log(error);
      setMessage(
        error?.response?.data?.message ||
          "Hesap oluşturulamadı, lütfen tekrar dene"
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isRegister) {
        await register();
      } else {
        await login();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      <div className="circle c1"></div>
      <div className="circle c2"></div>
      <div className="circle c3"></div>

      <form className="login-card" onSubmit={handleSubmit}>

        <div className="logo">
          <img src={logo} alt="Başarsoft Logo" />
        </div>

        <h1>Login Map Project</h1>

        <p className="subtitle">
          {isRegister
            ? "Yeni bir hesap oluştur"
            : "Haritaya erişmek için giriş yapınız"}
        </p>

        <input
          type="text"
          placeholder="Kullanıcı Adı"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Şifre"
          autoComplete={isRegister ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isRegister && (
          <input
            type="password"
            placeholder="Şifre (Tekrar)"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Lütfen bekleyin..."
            : isRegister
              ? "Hesap Oluştur"
              : "Giriş Yap"}
        </button>

        <p className="error-message">
          {message}
        </p>

        {successMessage && (
          <p className="success-message">
            {successMessage}
          </p>
        )}

        <p className="switch-mode">
          {isRegister ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}{" "}
          <button
            type="button"
            className="switch-mode-link"
            onClick={() => switchMode(isRegister ? "login" : "register")}
          >
            {isRegister ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </p>

      </form>

    </div>
  );
}

export default LoginPage;
