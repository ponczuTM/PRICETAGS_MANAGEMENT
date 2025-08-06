import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import logo from "../assets/images/logo.png";

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [userInfo, setUserInfo] = useState(null);

    const handleEmailChange = (e) => setEmail(e.target.value);
    const handlePasswordChange = (e) => setPassword(e.target.value);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        setUserInfo(null);

        try {
            const response = await fetch("http://localhost:8000/api/priceusers/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Login failed");
            }

            const data = await response.json();

            localStorage.setItem("token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));
            localStorage.setItem("locationId", data.user.locationId);

            setUserInfo(data.user);

            setTimeout(() => navigate("/mainpage"), 2500);
        } catch (error) {
            console.error("Login error:", error);
            setErrorMsg(error.message);
        }
    };

    return (
        <div className={styles.loginContainer}>
            <img src={logo} alt="Logo" className={styles.logo} />
            <h2>Zaloguj się</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        required
                        placeholder="jan.kowalski@example.com"
                    />
                </div>

                <div>
                    <label htmlFor="password">Hasło:</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        placeholder="••••••••"
                    />
                </div>

                <button type="submit">Zaloguj</button>

                {errorMsg && <p className={styles.errorMessage}>{errorMsg}</p>}
            </form>

            {userInfo && (
                <div className={styles.userInfo}>
                    <h3>Zalogowano pomyślnie!</h3>
                    {/* <p><strong>Imię:</strong> {userInfo.first_name}</p>
                    <p><strong>Nazwisko:</strong> {userInfo.last_name}</p>
                    <p><strong>Email:</strong> {userInfo.email}</p> */}
                    <p><strong>Location ID:</strong> {userInfo.locationId}</p>
                    <p className={styles.redirectMessage}>Za chwilę nastąpi przekierowanie...</p>
                </div>
            )}
        </div>
    );
};

export default Login;