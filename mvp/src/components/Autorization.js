import React, { useState } from 'react';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        // Простая проверка для демонстрации. В реальном приложении отправьте данные на сервер.
        if (username && password) {
            onLogin(); // Уведомляем родителя об успешном входе
        } else {
            alert('Введите имя пользователя и пароль');
        }
    };

    return (
        <div className="login-page">
            <h2>Вход</h2>
            <form onSubmit={handleLoginSubmit}>
                <input
                    type="text"
                    placeholder="Имя пользователя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">Войти</button>
            </form>
        </div>
    );
};

export default LoginPage;
