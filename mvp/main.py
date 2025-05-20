import base64
import io
import json
import os
import mysql.connector
import pymysql
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from transformers import CLIPModel, CLIPProcessor
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import urllib.parse
from monitoring_file import MonitoringController
from PIL import Image
from io import BytesIO
from typing import Optional

class Database:
    def __init__(self, host, port, user, password, database):
        try:
            self.connection = pymysql.connect(
                host=host,
                user=user,
                port=port,
                password=password,
                database=database,
                cursorclass=pymysql.cursors.DictCursor
            )
            print("Успешное подключение к базе данных")
        except Exception as e:
            print(f"Ошибка подключения к базе данных: {e}")
            self.connection = None

    def get_events_by_time(self, camera_id=None):
        if not self.connection:
            print("Нет соединения с базой данных")
            return []

        try:
            with self.connection.cursor() as cursor:
                query = """
                SELECT date_create, events_id, camera_id, pets_id, activity_id
                FROM events
                WHERE (%s IS NULL OR camera_id = %s)
                ORDER BY date_create;
                """
                cursor.execute(query, (camera_id, camera_id))
                results = cursor.fetchall()

                for result in results:
                    result["date_create"] = str(result["date_create"])

                return results
        except Exception as e:
            print(f"Ошибка при получении событий: {e}")
            return []

    def __del__(self):
        if self.connection:
            self.connection.close()
            print("Соединение с базой данных закрыто")

app = FastAPI()

# Конфигурация
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
IMAGE_QUALITY = 85
IMAGE_MAX_SIZE = (800, 800)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = ["http://localhost", "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        port=3306,
        user="root",
        password="pet_monitoring",
        database="pet_monitoring_system"
    )

db = Database(
    host='localhost',  
    port=3306,
    user='root',
    password='pet_monitoring',
    database='pet_monitoring_system'
)

def image_to_base64(image_blob):
    return base64.b64encode(image_blob).decode('utf-8')

model = CLIPModel.from_pretrained("best_fine_tuned_clip_model")
processor = CLIPProcessor.from_pretrained("best_fine_tuned_clip_processor")

def test_image(image: Image.Image, text: list[str], model, processor):
    inputs = processor(text=text, images=image, return_tensors="pt", padding=True)
    outputs = model(**inputs)
    logits_per_image = outputs.logits_per_image
    probs = torch.nn.functional.softmax(logits_per_image, dim=1)
    predicted_idx = torch.argmax(probs, dim=1).item()
    return probs, predicted_idx

@app.post("/predict/")
async def predict(file: UploadFile = File(...), text_input: str = Form(...)):
    text_input = json.loads(text_input)
    text = text_input["text"]

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))

    probs, predicted_idx = test_image(image, text, model, processor)

    result = {
        "predicted_text": text[predicted_idx],
        "probabilities": [round(prob.item(), 4) for prob in probs[0]]
    }
    return JSONResponse(content=result)

class Pet(BaseModel):
    pets_id: int
    pets_name: str
    pets_type: str
    pets_photo: str
    pets_history: str

@app.get("/pets/{home_id}", response_model=list[Pet])
async def get_pets(home_id: int):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM pets_cards WHERE user_id = %s", (home_id,))
    pets = cursor.fetchall()
    cursor.close()
    db.close()

    if not pets:
        raise HTTPException(status_code=404, detail="Питомцы не найдены")

    return pets

@app.get("/events")
async def get_events(camera_id: int = None):
    try:
        data = db.get_events_by_time(camera_id)
        if not data:
            raise HTTPException(status_code=404, detail="Данные отсутствуют")
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

from src.server import models, database, schemas   
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
 
@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = models.User(username=user.username, password=user.password)  # Для примера сохраняем пароль как есть
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@app.post("/login")
def login_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or db_user.password != user.password:  # Для примера сравниваем пароль как есть
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {"message": "Login successful"}

@app.get("/pets")
async def get_pets():
    try:
        connection = get_db_connection()
        with connection.cursor(dictionary=True) as cursor:  # Используем dictionary=True
            cursor.execute("SELECT * FROM pets")
            pets = cursor.fetchall()
            return {"status": "success", "data": pets}
            
    except Exception as e:
        print(f"Ошибка при получении питомцев: {str(e)}")  # Логируем ошибку
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка сервера: {str(e)}"
        )
    finally:
        if connection:
            connection.close()

@app.post("/pets")
async def create_pet(
    name: str = Form(...),
    animal_type: str = Form(...),
    year: Optional[int] = Form(None),
    breed: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None)
):
    connection = None
    filename = None
    
    try:

        type_lower = animal_type.lower()
        current_time = datetime.now()

        if animal_type.lower() not in ["кот", "собака"]:
            raise HTTPException(400, detail="Тип должен быть 'кот' или 'собака'")

        if image and image.filename:
            filename = await process_and_save_image(image, name)

        type_formatted = "Кот" if type_lower == "кот" else "Собака"

        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO pets (name, animal_type, year, breed, image, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (name, animal_type.lower(), year, breed, filename, current_time))
            
            connection.commit()
            pet_id = cursor.lastrowid
            
            return {
                "status": "success",
                "data": {
                    "id": pet_id,
                    "name": name,
                    "animal_type": type_formatted,
                    "year": year,
                    "breed": breed,
                    "image": f"/uploads/{urllib.parse.quote(filename)}" if filename else None,
                    "created_at": current_time.isoformat()
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        if filename and os.path.exists(f"uploads/{filename}"):
            os.remove(f"uploads/{filename}")
        raise HTTPException(500, detail=str(e))
    finally:
        if connection:
            connection.close()

@app.delete("/pets/by_name/{pet_name}")
async def delete_pet_by_name(pet_name: str):
    connection = None
    try:
        connection = get_db_connection()
        with connection.cursor(dictionary=True) as cursor:
            # Получаем информацию о питомце по имени (используем колонку 'image')
            cursor.execute("SELECT id, image FROM pets WHERE name = %s", (pet_name,))
            pet = cursor.fetchone()
            
            if not pet:
                raise HTTPException(status_code=404, detail="Питомец с таким именем не найден")
            
            if pet['image']:
                # Удаляем файл изображения, если он существует
                image_path = f"uploads/{pet['image']}"
                if os.path.exists(image_path):
                    os.remove(image_path)
            
            # Удаляем запись из базы данных
            cursor.execute("DELETE FROM pets WHERE id = %s", (pet['id'],))
            connection.commit()
            
            return {"status": "success", "message": f"Питомец {pet_name} удален"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Ошибка при удалении питомца")
    finally:
        if connection:
            connection.close()

def generate_filename(pet_name: str, original_filename: str) -> str:
    """Генерирует безопасное имя файла с поддержкой кириллицы"""
    # Получаем расширение файла
    ext = os.path.splitext(original_filename)[1].lower() or '.jpg'
    
    # Создаем безопасное имя (транслитерация + замена спецсимволов)
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
        'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
        'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
        'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
        'э': 'e', 'ю': 'yu', 'я': 'ya'
    }
    
    # Транслитерация
    name = ''.join(translit_map.get(c.lower(), c.lower()) for c in pet_name)
    # Замена недопустимых символов
    safe_name = ''.join(c if c.isalnum() else '_' for c in name)
    return f"{safe_name[:30]}{ext}"

async def process_and_save_image(file: UploadFile, pet_name: str) -> str:
    """Обрабатывает и сохраняет изображение с вашим именем файла"""
    # Проверяем расширение
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail="Допустимы только .jpg, .jpeg, .png, .webp")

    # Генерируем имя файла по вашему методу
    filename = generate_filename(pet_name, file.filename)
    filepath = os.path.join("uploads", filename)

    try:
        # Читаем и обрабатываем изображение
        contents = await file.read()
        img = Image.open(BytesIO(contents))
        
        # Конвертируем в RGB если нужно
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Изменяем размер сохраняя пропорции
        img.thumbnail(IMAGE_MAX_SIZE)
        
        # Сохраняем в оригинальном формате
        img.save(filepath, quality=IMAGE_QUALITY)
        
        return filename
    except Exception as e:
        print(f"Ошибка обработки изображения: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(500, detail="Ошибка обработки изображения")

# Новые методы для работы с камерами
@app.options("/cameras", status_code=200)
async def handle_options():
    return {"message": "OK"}

@app.post("/cameras")
async def create_camera(request: Request):
    try:
        data = await request.json()
        
        if not db.connection:
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Проверка обязательных полей
        if 'room' not in data or 'ip_camera' not in data:
            raise HTTPException(status_code=400, detail="Room and IP camera are required")
        
        with db.connection.cursor() as cursor:
            # Вставляем новую камеру
            sql = """INSERT INTO cameras 
                     (room, camera_name, camera_pass, ip_camera, port_camera, stream) 
                     VALUES (%s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (
                data['room'],
                data.get('camera_name'),
                data.get('camera_pass'),
                data['ip_camera'],
                data.get('port_camera'),
                data.get('stream')
            ))
            db.connection.commit()
            
            # Получаем ID новой камеры
            camera_id = cursor.lastrowid
            
            # Формируем ответ в формате, который ожидает фронтенд
            return {
                "status": "success",
                "data": {
                    "id": camera_id,
                    "room": data['room'],
                    "camera_name": data.get('camera_name'),
                    "camera_pass": data.get('camera_pass'),
                    "ip_camera": data['ip_camera'],
                    "port_camera": data.get('port_camera'),
                    "stream": data.get('stream')
                }
            }
            
    except Exception as e:
        print(f"Ошибка при добавлении камеры: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cameras")
async def get_cameras():
    try:
        with db.connection.cursor() as cursor:
            cursor.execute("SELECT * FROM cameras")
            cameras = cursor.fetchall()
            return JSONResponse(
                content={"status": "success", "data": cameras},
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/cameras/{camera_id}")
async def delete_camera(camera_id: int):
    try:
        with db.connection.cursor() as cursor:
            # Проверяем существование камеры
            cursor.execute("SELECT id FROM cameras WHERE id = %s", (camera_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Camera not found")
            
            # Удаляем камеру
            cursor.execute("DELETE FROM cameras WHERE id = %s", (camera_id,))
            db.connection.commit()
            
            return {"status": "success", "message": "Camera deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/activity_log")
async def create_activity_log():
    if not db.connection:
        raise HTTPException(status_code=500, detail="Database connection not available")
    
    try:
        with db.connection.cursor() as cursor:
            # Получаем текущую дату и время
            record_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # SQL запрос для вставки данных (только record_date)
            sql = """
            INSERT INTO activity_log (record_date)
            VALUES (%s)
            """
            cursor.execute(sql, (record_date,))
            
            # Фиксируем изменения в БД
            db.connection.commit()
            
            # Получаем ID новой записи
            log_id = cursor.lastrowid
            
            return {
                "status": "success",
                "message": "Activity log record created",
                "log_id": log_id,
                "record_date": record_date
            }
            
    except Exception as e:
        # Откатываем изменения в случае ошибки
        db.connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
# Инициализация контроллера мониторинга
monitoring_controller = MonitoringController()

@app.post("/start_rtsp_monitoring")
async def start_rtsp_monitoring(
    camera_id: int = Form(...),
    activity_id: int = Form(...)
):
    """
    Запускает мониторинг RTSP потока
    """
    try:
        result = monitoring_controller.start_monitoring(camera_id, activity_id)
        return {
            "status": "success",
            "message": "RTSP monitoring started",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop_rtsp_monitoring")
async def stop_rtsp_monitoring():
    """
    Останавливает текущий мониторинг RTSP потока
    """
    try:
        result = monitoring_controller.stop_monitoring()
        return {
            "status": "success",
            "message": "RTSP monitoring stopped",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitoring_status")
async def get_monitoring_status():
    """
    Возвращает текущий статус мониторинга
    """
    return monitoring_controller.get_status()

@app.get("/results_eat_and_toilet")
async def get_eat_and_toilet_results():
    if not db.connection:
        raise HTTPException(status_code=500, detail="Нет соединения с базой данных")
    
    try:
        with db.connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    date,
                    activity_id,
                    pets_id,
                    events_id,
                    `count` as count_rank
                FROM results_eat_and_toilet
                ORDER BY activity_id DESC, date DESC
            """)
            results = cursor.fetchall()
            formatted_results = []
            for result in results:
                formatted_result = dict(result)  # Создаем копию словаря
                if formatted_result['date']:
                    # Проверяем тип данных даты перед преобразованием
                    if isinstance(formatted_result['date'], str):
                        # Если дата уже в строковом формате, оставляем как есть
                        pass
                    elif hasattr(formatted_result['date'], 'isoformat'):
                        formatted_result['date'] = formatted_result['date'].isoformat()
                    else:
                        # Альтернативное преобразование для других типов
                        formatted_result['date'] = str(formatted_result['date'])
                formatted_results.append(formatted_result)
            
            return formatted_results
    except Exception as e:
        print(f"Ошибка при получении данных: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/results_rest_and_activity")
async def get_rest_and_activity_results():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                date_monitoring,
                activity_id,
                pets_id,
                events_id,
                minutes
            FROM results_reast_and_activity
            ORDER BY activity_id DESC, date_monitoring DESC
        """)
        
        results = cursor.fetchall()
        
        for result in results:
            if result['date_monitoring']:
                result['date_monitoring'] = result['date_monitoring'].isoformat()
        
        cursor.close()
        connection.close()
        
        return results
        
    except Exception as e:
        print(f"Ошибка при получении данных из results_reast_and_activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/cameras/{camera_id}/stream")
async def get_camera_stream(camera_id: int):
    try:
        rtsp_url = monitoring_controller._get_camera_rtsp_url(camera_id)
        if not rtsp_url:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "detail": f"Camera with ID {camera_id} not found"}
            )
        return {"status": "success", "url": rtsp_url}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": str(e)}
        )