import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ArticlesPage from './components/Articles';
import DetectPage from './components/Detection';
import EventsPage from './components/Actively';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Welcome from './components/Welcome';
import PetsPage from './components/Pets';
import Cameras from './components/Cameras';
import AuthorPage from './components/Author';

import './styles/articles.css';
import './styles/Buttons.css';
import './styles/detection.css';
import './styles/header.css';
import './styles/welcome.css';
import './styles/sidebar.css';
import './styles/styles.css';
import './styles/actively.css';
import './styles/pet.css';
import './styles/cameras.css';
import './styles/author.css';

const backgroundStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `
      linear-gradient(rgba(238, 226, 220, 0.4), rgba(238, 226, 220, 0.4)),
      url(${process.env.PUBLIC_URL}/lapki.jpg)
    `,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    zIndex: -1
  };

const App = () => {
    return (
        <div className="app-container">
            <div style={backgroundStyle}></div>
            <Header />
            <Sidebar />
            <div className="main-content">
                <Routes>
                    <Route path="/" element={<Welcome />} />
                    <Route path="/pet" element={<PetsPage/>} />
                    <Route path="/camera" element={<Cameras/>} />
                    <Route path="/active" element={<EventsPage />} />
                    <Route path="/detect" element={<DetectPage />} />
                    <Route path="/doc" element={<ArticlesPage />} />
                    <Route path="/author" element={<AuthorPage />} />
                </Routes>
            </div>
        </div>
    );
};

export default App;
