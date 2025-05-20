import { useLocation, useNavigate } from 'react-router-dom';

function Sidebar({ isLoggedIn }) {
    const location = useLocation();  // Получаем текущий путь
    const navigate = useNavigate();  // Для навигации

    const handleNavigation = (page) => {
        navigate(page); // Переходим на нужную страницу
    };

    return (
        <div className="sidebar">
            <ul>
                {/* Если пользователь не авторизован, показываем только "Главная страница" */}
                { !isLoggedIn && (
                    <li
                        className={location.pathname === '/' ? 'active' : ''}
                        onClick={() => handleNavigation('/')}
                    >
                        Главная страница
                    </li>
                )}

                {/* Если пользователь авторизован, показываем все остальные кнопки */}
                { isLoggedIn && (
                    <>
                        <li
                            className={location.pathname === '/' ? 'active' : ''}
                            onClick={() => handleNavigation('/')}
                        >
                            Главная страница
                        </li>
                        <li
                            className={location.pathname === '/pet' ? 'active' : ''}
                            onClick={() => handleNavigation('/pet')}
                        >
                            Информация о питомцах
                        </li>
                        <li
                            className={location.pathname === '/camera' ? 'active' : ''}
                            onClick={() => handleNavigation('/camera')}
                        >
                            Камеры
                        </li>
                        <li
                            className={location.pathname === '/active' ? 'active' : ''}
                            onClick={() => handleNavigation('/active')}
                        >
                            Мониторинг активности
                        </li>
                        <li
                            className={location.pathname === '/detect' ? 'active' : ''}
                            onClick={() => handleNavigation('/detect')}
                        >
                            Попробуй!
                        </li>
                        <li
                            className={location.pathname === '/doc' ? 'active' : ''}
                            onClick={() => handleNavigation('/doc')}
                        >
                            Полезные материалы
                        </li>
                        <li
                            className={location.pathname === '/author' ? 'active' : ''}
                            onClick={() => handleNavigation('/author')}
                        >
                            Об авторе
                        </li>
                      
                    </>
                )}
            </ul>
        </div>
    );
}

export default Sidebar;
