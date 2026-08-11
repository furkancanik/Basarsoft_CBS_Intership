import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./LoginPage.css";
import logo from "../assets/basarsoftlogo.png";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

 const login = async () => {
  try {
    const response = await axios.post(
      "http://localhost:5075/api/auth/login",
      {
        username,
        password,
      }
    );

    localStorage.setItem("token", response.data.token);

    window.location.href = "/map";
  } catch (error) {
    console.log(error);
    setMessage("Kullanıcı adı veya şifre hatalı");
  }
};
  return (
    <div className="login-page">

      <div className="circle c1"></div>
      <div className="circle c2"></div>
      <div className="circle c3"></div>

      <div className="login-card">

        <div className="logo">
        <img src={logo} alt="Başarsoft Logo" />
          </div>   

        <h1>Login Map Project</h1>

        <p className="subtitle">
          Haritaya erişmek için giriş yapınız
        </p>

        <input
          type="text"
          placeholder="Kullanıcı Adı"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button onClick={login}>
          Giriş Yap
        </button>

        <p className="error-message">
          {message}
        </p>

      </div>

    </div>
  );
}

export default LoginPage;