import React, { useEffect, useState } from 'react';

const PetsPage = () => {
  const [pets, setPets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    year: '',
    species: '',
    breed: '',
    image: null
  });
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [/*isLoading*/, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPets();
  }, []);


  const fetchPets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/pets');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setPets(result.data);
      } else {
        throw new Error(result.message || 'Неизвестная ошибка сервера');
      }
    } catch (error) {
      console.error('Ошибка загрузки питомцев:', error);
      setError('Не удалось загрузить список питомцев: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPet(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка типа файла
      if (!file.type.match('image.*')) {
        setError('Пожалуйста, загрузите изображение');
        return;
      }
      
      // Проверка размера файла (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер изображения не должен превышать 5MB');
        return;
      }

      setNewPet(prev => ({ ...prev, image: file }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleAddPet = () => {
    setShowModal(true);
    setError('');
  };


  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);

  const handleDeletePet = () => {
    if (pets.length === 0) {
      setError('Нет питомцев для удаления');
      return;
    }
    setShowDeleteModal(true);
  };

  const confirmDeletePet = async () => {
    if (!selectedPet) return;
    
    try {
      const response = await fetch(`http://localhost:8000/pets/by_name/${encodeURIComponent(selectedPet)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка при удалении питомца');
      }

      await fetchPets();
      setError('');
      setShowDeleteModal(false);
      setSelectedPet(null);

    } catch (error) {
      console.error('Ошибка при удалении питомца:', error);
      setError(error.message);
    }
  };
  
  const handleSavePet = async () => {
    try {
      const formData = new FormData();
      formData.append('name', newPet.name);
      formData.append('animal_type', newPet.species.toLowerCase()); // Приводим к нижнему регистру
      if (newPet.year) formData.append('year', newPet.year);
      if (newPet.breed) formData.append('breed', newPet.breed);
      if (newPet.image) {
        formData.append('image', newPet.image, encodeURIComponent(newPet.image.name)); // Добавляем имя файла
      }
  
      const response = await fetch('http://localhost:8000/pets', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка сервера');
      }
  
      // Обновляем список сразу из ответа сервера
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        setPets(prev => [...prev, result.data]);
      }
      
      setShowModal(false);
      setNewPet({ name: '', year: '', species: '', breed: '', image: null });
      setImagePreview('');
      setError('');
    } catch (error) {
      console.error('Ошибка:', error);
      setError(error.message);
    }
  };
  
  // Функция для склонения слова "год"
  const getAgeWord = (age) => {
    if (age % 100 >= 11 && age % 100 <= 19) return 'лет';
    
    switch(age % 10) {
      case 1: return 'год';
      case 2:
      case 3:
      case 4: return 'года';
      default: return 'лет';
    }
  };

  const getImageUrl = (pet) => {
    if (!pet?.image) return null;
    
    try {
      let imagePath = pet.image;
      
      // Если путь не начинается с /uploads, добавляем его
      if (!imagePath.startsWith('/uploads') && !imagePath.startsWith('http')) {
        imagePath = `/uploads/${imagePath}`;
      }
      
      // Декодируем URL один раз
      const decodedPath = decodeURIComponent(imagePath);
      
      // Для локального development
      if (!decodedPath.startsWith('http')) {
        return `http://localhost:8000${decodedPath}?t=${Date.now()}`;
      }
      
      return `${decodedPath}?t=${Date.now()}`;
    } catch (e) {
      console.error('Ошибка обработки URL:', e);
      return null;
    }
  };

  const calculatePetAge = (year) => {
    if (!year) return null; // Если год не указан
    
    const currentYear = new Date().getFullYear();
    const age = currentYear - parseInt(year);
    
    // Если год совпадает с текущим - возвращаем 1
    if (age === 0) return 1;
    
    // Для прошлых лет возвращаем возраст, для будущих - null
    return age > 0 ? age : null;
  };

  return (
    <div className="documentation-container_table_pet">
      <h1>Ваши питомцы</h1>
      <p className="pets-description">Добавьте данные о вашем питомце, чтобы мы могли отслеживать его состояние</p>
      <div className="buttons-container">
        <button className="action-button add-button" onClick={handleAddPet}>
          добавить
        </button>
        <button className="action-button delete-button" onClick={handleDeletePet}>
          удалить
        </button>
      </div>

      <div className="pets-table-container">
        {pets.length > 0 ? (
          pets.map(pet => (
            <div key={pet.id} className="pet-row">
              <h2 className="pet-name-header">{pet.name}</h2>
              <div className="pet-content-wrapper"> 
                <div className="pet-image-container">
                {pet.image ? (
                    <img style={{ maxWidth: '400px', maxHeight: '300px'}}
                      src={getImageUrl(pet) || '/default-pet.jpg'}
                      alt={pet.name || 'Питомец'}
                      onError={(e) => {
                        console.error('Ошибка загрузки изображения:', e.target.src);
                        e.target.onerror = null;
                        e.target.src = '/default-pet.jpg';
                      }}
                    />
                  ) : (
                    <div className="no-image">Нет фото</div>
                  )}
                </div>

                <table className="pet-info-table">
                  <tbody>
                    <tr>
                      <th>Вид:</th>
                      <td>{pet.animal_type}</td>
                    </tr>
                    {pet.year != null && (
                      <tr>
                        <th>Возраст:</th>
                        <td>{calculatePetAge(pet.year) !== null ? `${calculatePetAge(pet.year)} ${getAgeWord(calculatePetAge(pet.year))}` : 'Некорректный год рождения'}</td>
                      </tr>
                    )}
                    {pet.breed && (
                      <tr>
                        <th>Порода:</th>
                        <td>{pet.breed}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="no-pets-message">
            У вас пока нет добавленных питомцев
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Добавить нового питомца</h2>
            
            <div className="form-group">
              <label>Имя:</label>
              <input
                type="text"
                name="name"
                value={newPet.name}
                onChange={handleInputChange}
                placeholder="Введите имя питомца"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Год рождения:</label>
              <input
                type="number"
                name="year"
                value={newPet.year}
                onChange={handleInputChange}
                placeholder="Введите год рождения"
              />
            </div>
            
            <div className="form-group">
              <label>Вид:</label>
              <input
                type="text"
                name="species"
                value={newPet.species}
                onChange={handleInputChange}
                placeholder="Введите 'Кот' или 'Собака'"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Порода:</label>
              <input
                type="text"
                name="breed"
                value={newPet.breed}
                onChange={handleInputChange}
                placeholder="Введите породу"
              />
            </div>
            
            <div className="form-group">
              <label>Изображение:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Предпросмотр"/>
                </div>
              )}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-buttons">
              <button 
                className="action-button cancel-button"
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  setImagePreview('');
                }}
              >
                Отмена
              </button>
              <button 
                className="action-button save-button"
                onClick={handleSavePet}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для удаления */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Выберите питомца для удаления</h2>
            
            <div className="pet-list-to-delete">
              {pets.map(pet => (
                <div 
                  key={pet.id}
                  className={`pet-to-delete ${selectedPet === pet.name ? 'selected' : ''}`}
                  onClick={() => setSelectedPet(pet.name)}
                >
                  {pet.name} ({pet.animal_type}, {pet.year})
                </div>
              ))}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-buttons">
              <button 
                className="action-button cancel-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedPet(null);
                  setError('');
                }}
              >
                Отмена
              </button>
              <button 
                className="action-button delete-button"
                onClick={confirmDeletePet}
                disabled={!selectedPet}
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

export default PetsPage;