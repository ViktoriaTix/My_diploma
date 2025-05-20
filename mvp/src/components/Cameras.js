import React, { useEffect, useState, useCallback } from 'react';

const Cameras = () => {
  const [cameras, setCameras] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    room: '',
    camera_name: '',
    camera_pass: '',
    ip_camera: '',
    port_camera: '',
    stream: ''
  });
  const [error, setError] = useState('');
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSelectCameraModal, setShowSelectCameraModal] = useState(false);
  

  // Оптимизированная функция загрузки данных
  const fetchCameras = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:8000/cameras?_=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setCameras(result.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки камер:', error);
      setError('Не удалось загрузить список камер');
    }
  }, []);

  useEffect(() => {
    fetchCameras();
    const intervalId = setInterval(fetchCameras, 1000);
    return () => clearInterval(intervalId);
  }, [fetchCameras]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCamera(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  

  const handleAddCamera = () => {
    setShowModal(true);
    setError('');
  };

  const handleDeleteCamera = () => {
    if (cameras.length === 0) {
      setError('Нет камер для удаления');
      return;
    }
    setShowSelectCameraModal(true); // Показываем окно выбора вместо подтверждения
  };

  const handleSelectCamera = (camera) => {
    setSelectedCamera(camera);
    setShowSelectCameraModal(false);
    setShowDeleteModal(true); // Показываем окно подтверждения после выбора
  };

  const confirmDeleteCamera = async () => {
    if (!selectedCamera) return;
    
    try {
      const response = await fetch(`http://localhost:8000/cameras/${selectedCamera.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка при удалении камеры');
      }

      // Обновляем список камер после успешного удаления
      await fetchCameras();
      
      // Закрываем модальное окно и сбрасываем выбранную камеру
      setShowDeleteModal(false);
      setSelectedCamera(null);
      setError('');
    } catch (error) {
      console.error('Ошибка при удалении камеры:', error);
      setError(error.message);
    }
  };

  const handleSaveCamera = async () => {
    try {
      if (!newCamera.room || !newCamera.ip_camera) {
        throw new Error('Название комнаты и IP камеры обязательны');
      }
      
      const response = await fetch('http://localhost:8000/cameras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCamera),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка сервера');
      }   
      
      await fetchCameras(true);
      
      setShowModal(false);
      setNewCamera({
        room: '',
        camera_name: '',
        camera_pass: '',
        ip_camera: '',
        port_camera: '',
        stream: ''
      });
      setError('');
    } catch (error) {
      console.error('Ошибка:', error);
      setError(error.message);
    }
  };

  const handleCheckCamera = async (cameraId) => {
    try {
      const response = await fetch(`http://localhost:8000/cameras/${cameraId}/stream`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        // Открываем новое окно с инструкцией для конкретной камеры
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
          <html>
            <head>
              <title>RTSP Stream Player - Camera ${cameraId}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
                .btn { 
                  background: #1890ff; 
                  color: white; 
                  border: none; 
                  padding: 10px 15px; 
                  border-radius: 4px; 
                  cursor: pointer;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Инструкция для просмотра RTSP потока (Камера ID: ${cameraId})</h2>
                <p>Для просмотра потока выполните следующую команду в терминале:</p>
                <pre>ffplay -rtsp_transport tcp ${result.url}</pre>
                <p>Или скопируйте URL для использования в другом плеере:</p>
                <input type="text" value="${result.url}" readonly style="width: 100%; padding: 8px; margin-bottom: 10px;">
                <button class="btn" onclick="navigator.clipboard.writeText('${result.url}')">Копировать URL</button>
                <button class="btn" onclick="window.close()" style="background: #ff4d4f; margin-left: 10px;">Закрыть</button>
              </div>
            </body>
          </html>
        `);
      } else {
        throw new Error(result.detail || 'Не удалось получить поток камеры');
      }
    } catch (error) {
      console.error('Ошибка при проверке камеры:', error);
      setError(`Ошибка при проверке камеры ID ${cameraId}: ${error.message}`);
    }
  };

  return (
    <div className="documentation-container_table_cameras">
      <h1>Список камер</h1>
      <p className="pets-description">Добавьте данные своей IP камеры</p>
      <div className="buttons-container">
        <button className="action-button add-button" onClick={handleAddCamera}>
          добавить
        </button>
        <button className="action-button delete-button" onClick={handleDeleteCamera}>
          удалить
        </button>
      </div>

      <div className="cameras-list-container">
        {cameras.length > 0 ? (
          <div className="cameras-table">
            {cameras.map((camera, index) => (
              <div key={camera.id} className="camera-row">
                <div className="camera-number">{index + 1}</div>
                <div className="camera-room">{camera.room}</div>
                <button 
                  className="action-button check-button"
                  onClick={() => handleCheckCamera(camera.id)}
                >
                  Проверить камеру
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-cameras-message">
            Нет добавленных камер
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
         <div className="modal-content">
            <h2>Добавить камеру</h2>
            
            <div className="form-group">
              <label>Комната:</label>
              <input
                  type="text"
                  name="room"
                  value={newCamera.room}
                  onChange={handleInputChange}
                  placeholder="Например: Гостиная"
                  required
              />
            </div>
            
            <div className="form-group">
              <label>Логин:</label>
              <input
                  type="text"
                  name="camera_name"
                  value={newCamera.camera_name}
                  onChange={handleInputChange}
                  placeholder="Например: admin"
              />
            </div>
            
            <div className="form-group">
              <label>Пароль камеры:</label>
              <input
                  type="password"
                  name="camera_pass"
                  value={newCamera.camera_pass}
                  onChange={handleInputChange}
                  placeholder="Например: 12345"
              />
            </div>
            
            <div className="form-group">
              <label>IP камеры:</label>
              <input
                  type="text"
                  name="ip_camera"
                  value={newCamera.ip_camera}
                  onChange={handleInputChange}
                  placeholder="Например: 192.168.1.10"
                  required
              />
            </div>
            
            <div className="form-group">
              <label>Порт камеры:</label>
              <input
                  type="number"
                  name="port_camera"
                  value={newCamera.port_camera}
                  onChange={handleInputChange}
                  placeholder="Например: 554"
              />
            </div>
            
            <div className="form-group">
              <label>Поток:</label>
              <input
                  type="text"
                  name="stream"
                  value={newCamera.stream}
                  onChange={handleInputChange}
                  placeholder="Например: stream1, stream2"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-buttons">
              <button 
                  className="action-button cancel-button"
                  onClick={() => {
                  setShowModal(false);
                  setError('');
                  }}
              >
                  Отмена
              </button>
              <button 
                  className="action-button save-button"
                  onClick={handleSaveCamera}
              >
                  Сохранить
              </button>
            </div>
          </div>
        </div>
    )}

      {/* Модальное окно для удаления */}
      {showSelectCameraModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Выберите камеру для удаления</h2>
            <div className="cameras-select-list">
              {cameras.map(camera => (
                <div 
                  key={camera.id} 
                  className="camera-select-item"
                  onClick={() => handleSelectCamera(camera)}
                >
                  <div className="camera-select-room">{camera.room}</div>
                  <div className="camera-select-ip">{camera.ip_camera}</div>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button 
                className="action-button cancel-button"
                onClick={() => setShowSelectCameraModal(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Подтверждение удаления</h2>
            <p>Вы уверены, что хотите удалить камеру из комнаты "{selectedCamera?.room}" (IP: {selectedCamera?.ip_camera})?</p>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-buttons">
              <button 
                className="action-button cancel-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCamera(null);
                  setError('');
                }}
              >
                Отмена
              </button>
              <button 
                className="action-button delete-button"
                onClick={confirmDeleteCamera}
                disabled={!selectedCamera} // Делаем кнопку неактивной, если нет выбранной камеры
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      


    </div>
  );
};

export default Cameras;