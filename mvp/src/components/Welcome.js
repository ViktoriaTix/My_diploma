function Welcome() {
  return (
  <div className='helloPage'>
    <div className='textContainer'>
      <div className='largeText'>
        <h2>TailsTrack – питомец под присмотром,<br />пока вы на работе</h2>
      </div>
      <div className='smallText'>
        <p>Продуктом проекта «TailsTrack» является <br /> комплексная система видеонаблюдения и<br />
          аналитики для мониторинга активности <br /> кошек и собак. <br /></p>
      </div>
    </div>

    {/* Фоновый блок */}
    <div className='backgroundBlock'></div>

    {/* Блок с наложенными изображениями */}
    <div className='overlappingImages'>
      <img src='/hands_3.png' alt='Руки в форме сердца' className='photo hands' />
      <img src='/pets.png' alt='Фото питомцев' className='photo pets' />
    </div>
  </div>
  );
}

export default Welcome;
