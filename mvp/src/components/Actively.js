import axios from 'axios';
import React, { useEffect, useState } from 'react';

// Глобальная переменная для хранения ID камеры и лога
window.appGlobals = {
  selectedCameraId: null,
  activityLogId: null
};

const EventsPage = () => {
  const [eventsData, setEventsData] = useState([]);
  const [pets, setPets] = useState([]);
  const [resultsData, setResultsData] = useState([]);
  const [restActivityData, setRestActivityData] = useState([]);
  const [showTrackingOptions, setShowTrackingOptions] = useState(false);
  const [showResultsOptions, setShowResultsOptions] = useState(false);
  const [/*trackingTime*/, setTrackingTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [pendingDuration, setPendingDuration] = useState(null);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  const getImageUrl = (pet) => {
    if (!pet?.image) return null;
    
    try {
      let imagePath = pet.image;
      
      if (!imagePath.startsWith('/uploads') && !imagePath.startsWith('http')) {
        imagePath = `/uploads/${imagePath}`;
      }
      
      const decodedPath = decodeURIComponent(imagePath);
      
      if (!decodedPath.startsWith('http')) {
        return `http://localhost:8000${decodedPath}?t=${Date.now()}`;
      }
      
      return `${decodedPath}?t=${Date.now()}`;
    } catch (e) {
      console.error('Ошибка обработки URL:', e);
      return null;
    }
  };

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const response = await axios.get('http://localhost:8000/pets');
        
        // Используем тот же формат, что и в PetsPage
        if (response.data.status === 'success') {
          setPets(response.data.data);
        } else {
          setPets(response.data); // Если нет структуры status/data
        }
      } catch (error) {
        console.error('Ошибка при загрузке питомцев:', error);
      }
    };

    const fetchResults = async () => {
      try {
        const response = await axios.get('http://localhost:8000/results_eat_and_toilet');
        console.log('Данные results_eat_and_toilet:', response.data);
    
        // Преобразуем данные к единому формату
        const formattedData = response.data.map(item => ({
          ...item,
          count: item.count_rank // Используем count_rank как основное значение
        }));
    
        setResultsData(formattedData);
      } catch (error) {
        console.error('Ошибка при загрузке результатов:', error);
        setResultsData([]);
      }
    };

    const fetchRestActivity = async () => {
      try {
        const response = await axios.get('http://localhost:8000/results_rest_and_activity');
        console.log('Rest and activity data:', response.data);
        setRestActivityData(response.data);
      } catch (error) {
        console.error('Ошибка при загрузке данных об активности и отдыхе:', error);
      }
    };

    const fetchEvents = async () => {
      try {
        const response = await axios.get('http://localhost:8000/events');
        const events = response.data;

        const groupedData = events.reduce((acc, event) => {
          const { pets_id, events_id } = event;

          if (!acc[pets_id]) {
            acc[pets_id] = {
              pets_id,
              events: {
                1: 0,
                2: 0,
                3: 0,
                4: 0
              }
            };
          }

          acc[pets_id].events[events_id] += 1;
          return acc;
        }, {});

        setEventsData(Object.values(groupedData));
      } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
      }
    };

    const fetchCameras = async () => {
      try {
        const response = await axios.get('http://localhost:8000/cameras');
        setCameras(response.data.data || []);
      } catch (error) {
        console.error('Ошибка при загрузке камер:', error);
      }
    };

    fetchPets();
    fetchRestActivity();
    fetchResults();
    fetchEvents();
    fetchCameras();
  }, []);

  useEffect(() => {
    const savedTracking = localStorage.getItem('petTracking');
    if (savedTracking) {
      const { endTime: savedEndTime, duration } = JSON.parse(savedTracking);
      const endTimeDate = new Date(savedEndTime);
      const now = new Date();
      
      if (endTimeDate > now) {
        const secondsLeft = Math.floor((endTimeDate - now) / 1000);
        setEndTime(endTimeDate);
        setTimeLeft(secondsLeft);
        setTrackingTime(duration);
        setIsMonitoringActive(true);
      } else {
        localStorage.removeItem('petTracking');
      }
    }
  }, []);

  useEffect(() => {
    if (!endTime) return;

    const timer = setInterval(async() => {
      const now = new Date();
      const secondsLeft = Math.floor((endTime - now) / 1000);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        setTimeLeft(null);
        setTrackingTime(null);
        setEndTime(null);
        setIsMonitoringActive(false);
        localStorage.removeItem('petTracking');
        stopMonitoring();
        // Добавляем остановку мониторинга на бэкенде
        try {
          await stopMonitoring(); // Вызываем функцию остановки
        } catch (error) {
          console.error('Ошибка при автоматической остановке мониторинга:', error);
        }
      } else {
        setTimeLeft(secondsLeft);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  useEffect(() => {
    if (selectedCameraId !== null) {
      window.appGlobals.selectedCameraId = selectedCameraId;
    }
  }, [selectedCameraId]);

  const logActivity = async () => {
    
    
    try {
      const response = await axios.post('http://localhost:8000/activity_log');
            
      if (response.data && response.data.log_id) {
        window.appGlobals.activityLogId = response.data.log_id;
      }
      
      return response.data.log_id;
    } catch (error) {
      console.error('Ошибка при записи в лог:', error);
      throw error;
    }
  };

  const stopMonitoring = async () => {
    try {
      const response = await axios.post('http://localhost:8000/stop_rtsp_monitoring');
      console.log('Мониторинг остановлен:', response.data);
      
      // Сбрасываем состояние мониторинга
      setTimeLeft(null);
      setTrackingTime(null);
      setEndTime(null);
      setIsMonitoringActive(false);
      localStorage.removeItem('petTracking');
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при остановке мониторинга:', error);
      throw error;
    }
  };

  const startTracking = async (duration, seconds) => {
    const endTime = new Date();
    endTime.setSeconds(endTime.getSeconds() + seconds);
    
    setEndTime(endTime);
    setTimeLeft(seconds);
    setTrackingTime(duration);
    setShowTrackingOptions(false);
    setIsMonitoringActive(true);
    
    localStorage.setItem('petTracking', JSON.stringify({
      endTime: endTime.toISOString(),
      duration
    }));
    
    try {
      await logActivity();
      
      const formData = new FormData();
      formData.append('camera_id', window.appGlobals.selectedCameraId);
      formData.append('activity_id', window.appGlobals.activityLogId);
      
      const response = await axios.post(
        'http://localhost:8000/start_rtsp_monitoring',
        formData
      );
      
      console.log('Мониторинг запущен:', response.data);
      
    } catch (error) {
      console.error('Ошибка при запуске мониторинга:', error);
    }
  };

  const handleStartTracking = (duration) => {
    setPendingDuration(duration);
    setShowCameraModal(true);
    setShowTrackingOptions(false);
  };

  const confirmCameraSelection = () => {
    if (!selectedCameraId) {
      alert('Пожалуйста, выберите камеру');
      return;
    }
    
    window.appGlobals.selectedCameraId = selectedCameraId;
    
    console.log('Перед стартом отслеживания:', {
      localState: selectedCameraId,
      globalVar: window.appGlobals.selectedCameraId
    });

    switch(pendingDuration) {
      case '2 часа': 
        startTracking(pendingDuration, 2 * 60 * 60);
        break;
      case '10 часов':
        startTracking(pendingDuration, 10 * 60 * 60);
        break;
      case '1 день':
        startTracking(pendingDuration, 24 * 60 * 60);
        break;
      default:
        return;
    }

    setShowCameraModal(false);
    setPendingDuration(null);
  };

  const handleViewResults = async (period) => {
    console.log(`Просмотр результатов за ${period}`);
    setShowResultsOptions(false);
    setResultsPeriod(period);
    
    try {
      // Перезагружаем данные при смене периода
      const resultsResponse = await axios.get('http://localhost:8000/results_eat_and_toilet');
      const activityResponse = await axios.get('http://localhost:8000/results_rest_and_activity');
      
      setResultsData(resultsResponse.data);
      setRestActivityData(activityResponse.data);
      
      setShowResults(true);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      setShowResults(false);
    }
  };

  const [resultsPeriod, setResultsPeriod] = useState('текущие результаты');

  const toggleTrackingOptions = () => {
    setShowTrackingOptions(!showTrackingOptions);
    setShowResultsOptions(false);
  };

  const toggleResultsOptions = () => {
    setShowResultsOptions(!showResultsOptions);
    setShowTrackingOptions(false);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')} ч ${minutes.toString().padStart(2, '0')} мин ${secs.toString().padStart(2, '0')} сек`;
  };

  
  const renderResultsTable = (petId) => {
    // Функция для форматирования минут
    const formatMinutes = (minutes) => {
      if (minutes === null || minutes === undefined) return 'Н/Д';
      const mins = Math.round(minutes);
      if (mins < 60) return `${mins} мин`;
      const hours = Math.floor(mins / 60);
      const remainingMinutes = mins % 60;
      return `${hours} ч ${remainingMinutes} мин`;
    };
  
    // Получаем текущую дату
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    // Находим питомца
    const pet = pets.find(p => p.id === petId) || {};
    const petAge = pet.year ? new Date().getFullYear() - parseInt(pet.year) : null;
    const isCat = ['кот', 'кошка'].includes(pet.animal_type?.toLowerCase());
    const isDog = ['собака', 'пес'].includes(pet.animal_type?.toLowerCase());
  
    // Функция для получения данных за конкретный день
    const getDayData = (date) => {
      // Получаем дату в UTC для корректного сравнения
      const dateUTC = new Date(Date.UTC(
        date.getFullYear(), 
        date.getMonth(), 
        date.getDate()
      ));
      const dateStr = dateUTC.toISOString().split('T')[0]; // "YYYY-MM-DD"
      
      // Для таблицы results_eat_and_toilet
      const dayEatToilet = resultsData.filter(item => {
        // Приводим дату из базы к UTC
        const dbDate = item.date ? new Date(item.date + 'T00:00:00Z') : null;
        return (item.pets_id === petId) && 
              dbDate && 
              dbDate.getTime() === dateUTC.getTime();
      });

      // Для таблицы results_reast_and_activity
      const dayRestActivity = restActivityData.filter(item => {
        const dbDate = item.date_monitoring ? 
          new Date(item.date_monitoring + 'T00:00:00Z') : 
          null;
        return (item.pets_id === petId) && 
              dbDate && 
              dbDate.getTime() === dateUTC.getTime();
      });
    
      // Суммируем данные
      const sumData = {
        eatCount: 0,
        toiletCount: 0,
        activityMinutes: 0,
        restMinutes: 0
      };
    
      // Обработка данных из results_eat_and_toilet
      dayEatToilet.forEach(item => {
        const count = item.count_rank || item.count || 0; // Учитываем разные названия полей
        
        if (item.events_id === 1) { // Кормление
          sumData.eatCount += count;
        } 
        else if (item.events_id === 4) { // Туалет
          sumData.toiletCount += count;
        }
      });
    
      // Обработка данных из results_reast_and_activity
      dayRestActivity.forEach(item => {
        const minutes = item.minutes || 0;
        
        if (item.events_id === 2) { // Активность
          sumData.activityMinutes += minutes;
        } 
        else if (item.events_id === 3) { // Отдых
          sumData.restMinutes += minutes;
        }
      });
    
      console.log(`Данные за ${dateStr} для питомца ${petId}:`, {
        eatCount: sumData.eatCount,
        toiletCount: sumData.toiletCount,
        activityMinutes: sumData.activityMinutes,
        restMinutes: sumData.restMinutes,
        sourceEatToilet: dayEatToilet,
        sourceRestActivity: dayRestActivity
      });
    
      return {
        ...sumData,
        date: date,
        hasData: dayEatToilet.length > 0 || dayRestActivity.length > 0
      };
    };
  
    // Получаем данные за неделю (7 дней, включая сегодня)
    const getWeekData = () => {
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        weekData.push(getDayData(date));
      }
      return weekData;
    };
  
    // Получаем данные за сегодня
    const getTodayData = () => {
      const dayData = getDayData(today);
      return {
        ...dayData,
        noData: !dayData.hasData,
        message: 'Сегодня отслеживание не проводилось'
      };
    };
  
    // Получаем последние данные (как было раньше)
    const getLatestData = () => {
      // Находим максимальный activity_id среди всех данных (в обеих таблицах)
      const allActivityIds = [
        ...resultsData.map(item => item.activity_id),
        ...restActivityData.map(item => item.activity_id)
      ].filter(id => id !== undefined && id !== null);

      if (allActivityIds.length === 0) {
        return { noData: true, message: 'Нет данных об активностях' };
      }

      const maxActivityId = Math.max(...allActivityIds);

      // Получаем данные для текущего питомца с максимальным activity_id
      const petEatToiletData = resultsData.filter(
        item => item.pets_id === petId && item.activity_id === maxActivityId
      );

      const petRestActivityData = restActivityData.filter(
        item => item.pets_id === petId && item.activity_id === maxActivityId
      );

      // Суммируем данные
      const result = {
        eatCount: petEatToiletData.reduce((sum, item) => 
          sum + (item.events_id === 1 ? (item.count_rank || item.count || 0) : 0), 0),
        toiletCount: petEatToiletData.reduce((sum, item) => 
          sum + (item.events_id === 4 ? (item.count_rank || item.count || 0) : 0), 0),
        activityMinutes: petRestActivityData.reduce((sum, item) => 
          sum + (item.events_id === 2 ? (item.minutes || 0) : 0), 0),
        restMinutes: petRestActivityData.reduce((sum, item) => 
          sum + (item.events_id === 3 ? (item.minutes || 0) : 0), 0),
        date: null, // Дата будет определена ниже
        noData: false,
        activityId: maxActivityId
      };

      // Находим дату последней активности
      let latestDate = null;
      
      // Проверяем даты в results_eat_and_toilet
      petEatToiletData.forEach(item => {
        const itemDate = item.date ? new Date(item.date + 'T00:00:00Z') : null;
        if (itemDate && (!latestDate || itemDate > latestDate)) {
          latestDate = itemDate;
        }
      });

      // Проверяем даты в restActivityData
      petRestActivityData.forEach(item => {
        const itemDate = item.date_monitoring ? new Date(item.date_monitoring + 'T00:00:00Z') : null;
        if (itemDate && (!latestDate || itemDate > latestDate)) {
          latestDate = itemDate;
        }
      });

      result.date = latestDate || new Date(); // Если дату не нашли, используем текущую

      console.log(`Данные для питомца ${petId} по activity_id ${maxActivityId}:`, {
        eatCount: result.eatCount,
        toiletCount: result.toiletCount,
        activityMinutes: result.activityMinutes,
        restMinutes: result.restMinutes,
        date: result.date.toISOString().split('T')[0]
      });

      return result;
    };
      
    // Функция для получения суточных норм
    const getDailyNorms = () => {
      if (!petAge || (!isCat && !isDog)) return {
        eating: 'Н/Д',
        toilet: 'Н/Д',
        activity: 'Н/Д',
        rest: 'Н/Д'
      };
  
      if (petAge <= 1) {
        return isCat ? {
          eating: '3-4 раза',
          toilet: '6-8 раз',
          activity: '3-5 часов',
          rest: '19-21 час'
        } : {
          eating: '3-4 раза',
          toilet: '8-10 раз',
          activity: '4-6 часов',
          rest: '18-20 часов'
        };
      }
      else if (petAge > 1 && petAge < 7) {
        return isCat ? {
          eating: '2-3 раза',
          toilet: '2-4 раза',
          activity: '10 часов',
          rest: '14 часов'
        } : {
          eating: '2 раза',
          toilet: '3-5 раз',
          activity: '12 часов',
          rest: '12 часов'
        };
      }
      else {
        return isCat ? {
          eating: '2-3 раза',
          toilet: '3-5 раз',
          activity: '4 часа',
          rest: '20 часов'
        } : {
          eating: '2 раза',
          toilet: '4-6 раз',
          activity: '8 часов',
          rest: '16 часов'
        };
      }
    };
  
    const dailyNorms = getDailyNorms();
  
    // Рендеринг таблицы для одного дня
    const renderDayTable = (dayData) => {
      return (
        <table className="event-table">
          <thead>
            <tr>
              <th>Показатели</th>
              <th>Собранные данные</th>
              <th>Средняя норма в сутки</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Количество кормления</td>
              <td>{dayData.eatCount || 'Н/Д'}</td>
              <td>{dailyNorms.eating}</td>
            </tr>
            <tr>
              <td>Количество походов в туалет</td>
              <td>{dayData.toiletCount || 'Н/Д'}</td>
              <td>{dailyNorms.toilet}</td>
            </tr>
            <tr>
              <td>Время активности</td>
              <td>{formatMinutes(dayData.activityMinutes)}</td>
              <td>{dailyNorms.activity}</td>
            </tr>
            <tr>
              <td>Время сна</td>
              <td>{formatMinutes(dayData.restMinutes)}</td>
              <td>{dailyNorms.rest}</td>
            </tr>
          </tbody>
        </table>
      );
    };
  
    // Рендеринг для режима "1 неделя"
    if (resultsPeriod === '1 неделя') {
      const weekData = getWeekData();
      
      return (
        <div className="week-results-container">
          
          {weekData.map((dayData, index) => (
            <div key={index} className="day-results">
              <h4 className="day-header">
                {dayData.date.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
                {index === 0 && ' (сегодня)'}
                {index === 1 && ' (вчера)'}
              </h4>
              
              {dayData.hasData ? (
                renderDayTable(dayData)
              ) : (
                <div className="no-data-message">
                  В этот день отслеживание не проводилось
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
  
    // Рендеринг для других режимов ("текущие результаты" и "1 день")
    const displayData = resultsPeriod === '1 день' ? getTodayData() : getLatestData();
  
    if (displayData.noData) {
      return (
        <div className="pet-results-container">
          <div className="no-data-message">
            <p>{displayData.message}</p>
            {resultsPeriod === '1 день' && (
              <p className="current-date">
                {today.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>
      );
    }
  
    return (
      <div className="pet-results-container">
        <p className="date-info">
          {resultsPeriod === '1 день' ? 
            `Данные за ${today.toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}` : 
            'Последние данные'}
        </p>
        
        {renderDayTable(displayData)}
      </div>
    );
  };
  

  return (
    <div className="documentation-container_table">
      <h1>Активность ваших питомцев</h1>
      <p className="pets-description">Здесь вы можете запустить мониторинг активности ваших питомцев, после выбора промежутка времени укажите камеру, по которой будет вестись наблюдение. Вы также можете прервать отслеживание и посмотреть полученные результаты</p>
      <div className="buttons-container_active">
        <div className="dropdown">
          <button className="track-button" onClick={toggleTrackingOptions}>
            Запустить отслеживание
          </button>
          {showTrackingOptions && (
            <div className="dropdown-content">
              <div onClick={() => handleStartTracking('2 часа')}>2 часа</div>
              <div onClick={() => handleStartTracking('10 часов')}>10 часов</div>
              <div onClick={() => handleStartTracking('1 день')}>1 день</div>
            </div>
          )}
        </div>

        <div className="dropdown">
            <button className="results-button" onClick={toggleResultsOptions}>
              Посмотреть результаты
            </button>
            {showResultsOptions && (
              <div className="dropdown-content">
                <div onClick={() => handleViewResults('текущие результаты')}>Последние результаты</div>
                <div onClick={() => handleViewResults('1 день')}>1 день</div>
                <div onClick={() => handleViewResults('1 неделя')}>1 неделя</div>
              </div>
            )}
        </div>

        {isMonitoringActive && (
          <button 
            className="stop-monitoring-button"
            onClick={stopMonitoring}
          >
            Прервать мониторинг
          </button>
        )}
      </div>

      {timeLeft !== null && (
        <div className="tracking-info">
          <p>До конца отслеживания осталось: {formatTime(timeLeft)}</p>
          {selectedCameraId && (
            <p>
              Выбранная камера: {cameras.find(c => c.id === selectedCameraId)?.room || 'неизвестно'} 
            </p>
          )}
        </div>
      )}
      
      {showResults && eventsData.length > 0 ? (
        <div className="pets-table-container_active">
          {eventsData.map(group => {
            const pet = pets.find(p => p.id === group.pets_id) || {};
            
            return (
              <div key={group.pets_id} className="pet-row">
                <h2 className="pet-name-header">{pet.name || `Питомец #${group.pets_id}`}</h2>
                <div className="pet-content-wrapper"> 
                  <div className="pet-image-container">
                    <img 
                      style={{ maxWidth: '400px', maxHeight: '300px' }}
                      src={getImageUrl(pet) || '/default-pet.jpg'}
                      alt={pet.name || 'Питомец'}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/default-pet.jpg';
                      }}
                    />
                  </div>

                  {renderResultsTable(group.pets_id)}
                </div>
              </div>
            );
          })}
        </div>
      ) : showResults ? (
        <div className="no-pets-message">Данные отсутствуют</div>
      ) : null}

      {showCameraModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Выберите камеру для отслеживания</h3>
            <div className="cameras-list">
              {cameras.length > 0 ? (
                cameras.map(camera => (
                  <div 
                    key={camera.id} 
                    className={`camera-item ${selectedCameraId === camera.id ? 'selected' : ''}`}
                    onClick={() => {
                      const newCameraId = camera.id;
                      setSelectedCameraId(newCameraId);
                      window.appGlobals.selectedCameraId = newCameraId;
                    }}
                  >
                    {camera.room}
                  </div>
                ))
              ) : (
                <p className="no-cameras-message">Нет доступных камер</p>
              )}
            </div>
            <div className="modal-buttons">
              <button onClick={() => {
                setShowCameraModal(false);
                setPendingDuration(null);
                setSelectedCameraId(null);
                window.appGlobals.selectedCameraId = null;
              }}>Отмена</button>
              <button 
                onClick={confirmCameraSelection}
                disabled={!selectedCameraId}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;