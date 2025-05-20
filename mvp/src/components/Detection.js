import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [text, /*setText*/] = useState([
    "the animal eats",
    "the animal is actively moving",
    "the animal is at peace or relax",
    "the animal goes to the toilet"
  ]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [/*fileName*/, setFileName] = useState('');
  const [submitted, setSubmitted] = useState(false); // State to track submission

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    if (file && allowedTypes.includes(file.type)) {
      setError(null);
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setFileName(file.name);

      // Reset result and submission state when a new image is uploaded
      setResult(null);
      setSubmitted(false);  // Reset submitted state
    } else {
      setError('Invalid file type. Please upload a JPEG, JPG, or PNG image.');
      setImage(null);
      setImagePreview(null);
      setFileName('');
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('Please upload a valid image first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', image);
    formData.append('text_input', JSON.stringify({ text }));

    try {
      const response = await axios.post('http://localhost:8000/predict/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      setSubmitted(true); // Set submitted to true after getting the result
    } catch (error) {
      console.error("Error sending request:", error.response || error.message);
      setError('Failed to get prediction. Please try again later.');
      setSubmitted(false); // Reset to false if there was an error
    }
  };

  return (
    <div className="app-container_detect">
      <div className="main-content_detect">
        {/* Adding the new text above everything */}
        <h1 className="custom-header">
          Попробуйте своими лапками!
        </h1>
        <p className="pets-description">Здесь вы можете проверить работу нашей нейронной сети на своём изображении. Загрузите изображение в систему, кликнув на кнопку "Загрузить", и затем подтвердите отправку изображения в нейронноую сеть. Вы увидите как наша модель определяет в каком состоянии находится питомец на изображении</p>
        {/* Left Column: Upload and Submit buttons */}
        <div className="upload-container">
          {/* Upload Button */}
          <div className="image-button-container">
            <label htmlFor="file-input" className="image-button">
              <img src="lapka.png" alt="Upload" />
            </label>
            <p className="button-text">Загрузить</p>
          </div>

          <input
            type="file"
            id="file-input"
            onChange={handleImageChange}
            accept="image/jpeg, image/png, image/jpg"
          />

          {/* Submit Button */}
          <div className="image-button-container confirm-button-container">
            <button className="image-button submit-button" onClick={handleSubmit}>
              <img src="lapka.png" alt="Submit" />
            </button>
            <p className="button-text">Продолжить</p>
          </div>
        </div>

        {/* Display message when image is uploaded but not submitted */}
        {imagePreview && !submitted && (
          <div className="pets-description">
            Изображение загружено, чтобы запустить работу модели нажмите кнопку "Продолжить"
          </div>
        )}

        {/* Display Error if Image is Invalid or API Request Fails */}
        {error && <div className="error-message">{error}</div>}

        {/* Display Image and Prediction Results after Submit */}
        {submitted && imagePreview && result && (
          <div className="result-container">
            {/* Image Preview Block */}
            <div className="image-preview">
              <h2>Ваш питомец:</h2>
              <img src={imagePreview} alt="Uploaded Preview" />
            </div>

            {/* Prediction Results Block */}
            <div className="prediction">
              <h2>Результат работы модели:</h2>
              <p><strong>Что делает животное:</strong> {result.predicted_text}</p>
              <h3>Вероятности всех классов:</h3>
              <ul>
                {result.probabilities.map((prob, index) => (
                  <li key={index}>{text[index]}: {prob}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;