import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Импортируем useNavigate
import Sidebar from './Sidebar'; // Импортируем Sidebar, чтобы передавать данные о пользователе

function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Отслеживаем, вошел ли пользователь
  const [showForm, setShowForm] = useState(false); // Показываем форму (регистрация/вход)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formType, setFormType] = useState(''); // Тип формы: 'register' или 'login'
  const navigate = useNavigate(); // Хук для навигации

  // Проверка на авторизацию при загрузке
  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated");
    setIsLoggedIn(authStatus === "true");
  }, []);

  const handleOpenForm = (type) => {
    setFormType(type); // Устанавливаем тип формы ('register' или 'login')
    setShowForm(true); // Показываем форму
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();

    // Обработка формы (регистрация/вход)
    setIsLoggedIn(true); // Устанавливаем состояние "вошел в систему"
    localStorage.setItem("isAuthenticated", "true"); // Сохраняем статус в localStorage
    setShowForm(false); // Закрываем форму
    setUsername('');
    setPassword('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false); // Сбрасываем состояние пользователя
    localStorage.setItem("isAuthenticated", "false"); // Убираем статус из localStorage
    navigate('/'); // Перенаправляем на главную страницу
  };

  return (
    <header className="header">
      <div className="logo"></div>
      <div className="right-side">
        {!isLoggedIn && !showForm ? (
          <>
            <button className="register-button" onClick={() => handleOpenForm('register')}>
              Зарегистрироваться
            </button>
            <button className="login-button" onClick={() => handleOpenForm('login')}>
              Войти
            </button>
          </>
        ) : null}

        {isLoggedIn && (
          <button className="logout-button" onClick={handleLogout}>
            Выйти
          </button>
        )}
      </div>

      {/* Всплывающее окно */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-window">
            <span className="close" onClick={() => setShowForm(false)}>
              &times;
            </span>
            <h2>{formType === 'register' ? 'Регистрация' : 'Войти'}</h2>
            <form onSubmit={handleFormSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit">
                {formType === 'register' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Передаем isLoggedIn в Sidebar */}
      <Sidebar isLoggedIn={isLoggedIn} />
    </header>
  );
}

export default Header;
