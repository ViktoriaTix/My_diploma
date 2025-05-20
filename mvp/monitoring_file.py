import cv2
import threading
import time
import datetime
import os
import pymysql
from ultralytics import YOLO
from PIL import Image
import torch
from transformers import CLIPModel, CLIPProcessor
import shutil
from collections import defaultdict


class ClassFixer:
    """Стабилизатор классов для уменьшения флуктуаций между кадрами"""
    def __init__(self, threshold=3, max_age=30):
        self.threshold = threshold
        self.max_age = max_age
        self.stability = defaultdict(lambda: {
            "last_class": None,
            "count": 0,
            "fixed_class": None,
            "age": 0
        })

    def update(self, object_id, new_class):
        # Сброс возраста при появлении объекта
        entry = self.stability[object_id]
        entry["age"] = 0

        if entry["fixed_class"] is not None:
            return entry["fixed_class"]

        if new_class == entry["last_class"]:
            entry["count"] += 1
        else:
            entry["last_class"] = new_class
            entry["count"] = 1

        if entry["count"] >= self.threshold:
            entry["fixed_class"] = new_class

        return entry["fixed_class"]

    def age_all(self, current_ids):
        """Увеличивает возраст неактивных объектов и удаляет старые"""
        to_delete = []
        for object_id, entry in self.stability.items():
            if object_id not in current_ids:
                entry["age"] += 1
                if entry["age"] > self.max_age:
                    to_delete.append(object_id)
        for object_id in to_delete:
            self.stability.pop(object_id)



class MonitoringController:
    def __init__(self):
        self.active = False
        self.thread = None
        self.lock = threading.Lock()
        self.camera_id = None
        self.activity_id = None
        self.rtsp_url = None
        
        # Инициализация моделей
        self.yolo_model = YOLO("./best_yolov8s_train_35.pt")
        self.llm = self.LLM()
        
        # Инициализация трекера и стабилизатора классов
        self.class_fixer = ClassFixer(threshold=3, max_age=30)
        
        # Подключение к БД
        self.db = pymysql.connect(
            host='localhost',
            user='root',
            password='pet_monitoring',
            database='pet_monitoring_system',
            cursorclass=pymysql.cursors.DictCursor
        )

    class LLM:
        def __init__(self):
            self.model = CLIPModel.from_pretrained("./best_fine_tuned_clip_model")
            self.processor = CLIPProcessor.from_pretrained("./best_fine_tuned_clip_processor")
            self.text = [
                "the animal eats",
                "the animal is actively",
                "the animal is resting",
                "the animal goes to the toilet"
            ]

        def predict(self, image_path):
            try:
                image = Image.open(image_path)
                inputs = self.processor(text=self.text, images=image, return_tensors="pt", padding=True)
                outputs = self.model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = torch.nn.functional.softmax(logits_per_image, dim=1)
                predicted_idx = torch.argmax(probs, dim=1).item()
                confidence = probs[0][predicted_idx].item()
                return predicted_idx + 1, confidence
            except Exception as e:
                return None, None
            finally:
                if os.path.exists(image_path):
                    os.remove(image_path)

        def age_all(self, current_ids):
            """Увеличивает возраст неактивных объектов и удаляет старые"""
            to_delete = []
            for object_id, entry in self.stability.items():
                if object_id not in current_ids:
                    entry["age"] += 1
                    if entry["age"] > self.max_age:
                        to_delete.append(object_id)
            for object_id in to_delete:
                self.stability.pop(object_id)

    def _check_db_connection(self):
        try:
            with self.db.cursor() as cursor:
                cursor.execute("SELECT 1")
                return True
        except (pymysql.OperationalError, pymysql.InterfaceError):
            try:
                self.db.ping(reconnect=True)
                return True
            except Exception:
                self.db = pymysql.connect(
                    host='localhost',
                    user='root',
                    password='pet_monitoring',
                    database='pet_monitoring_system',
                    cursorclass=pymysql.cursors.DictCursor
                )
                return True
        except Exception:
            return False

    def start_monitoring(self, camera_id, activity_id):
        with self.lock:
            # Проверяем и восстанавливаем соединение с БД
            if not self._check_db_connection():
                raise Exception("Не удалось восстановить соединение с базой данных")

            if self.active:
                self.stop_monitoring()

            rtsp_url = self._get_camera_rtsp_url(camera_id)
            if not rtsp_url:
                raise Exception("RTSP URL not found for this camera")

            if not self._check_activity_exists(activity_id):
                raise Exception("Activity log not found")

            self.camera_id = camera_id
            self.activity_id = activity_id
            self.rtsp_url = rtsp_url
            self.active = True

            self.thread = threading.Thread(
                target=self._process_rtsp_stream,
                daemon=True
            )
            self.thread.start()

            return {
                "camera_id": camera_id,
                "activity_id": activity_id,
                "rtsp_url": rtsp_url
            }

    def stop_monitoring(self):
        with self.lock:
            if not self.active:
                return {"message": "No active monitoring"}

            self.active = False
            stopped_camera = self.camera_id
            stopped_activity = self.activity_id

            if self.thread and self.thread.is_alive():
                self.thread.join(timeout=5)

            self._cleanup_cropped_images()

            self.thread = None
            self.camera_id = None
            self.activity_id = None
            self.rtsp_url = None

            return {
                "stopped_camera": stopped_camera,
                "stopped_activity": stopped_activity
            }

    def _cleanup_cropped_images(self):
        """Удаляет все файлы в папке cropped_images с улучшенной обработкой ошибок"""
        save_dir = "cropped_images"
        max_retries = 3
        retry_delay = 1  # секунда
        
        try:
            if not os.path.exists(save_dir):
                print(f"Папка {save_dir} не существует, очистка не требуется")
                return

            print(f"Начинаем очистку папки {save_dir}...")
            
            for filename in os.listdir(save_dir):
                file_path = os.path.join(save_dir, filename)
                
                for attempt in range(max_retries):
                    try:
                        if os.path.isfile(file_path):
                            os.unlink(file_path)
                            print(f"Удалён файл: {file_path}")
                            break
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                            print(f"Удалена папка: {file_path}")
                            break
                    except PermissionError as e:
                        if attempt == max_retries - 1:
                            print(f"Не удалось удалить {file_path} после {max_retries} попыток: {e}")
                        time.sleep(retry_delay)
                    except Exception as e:
                        print(f"Ошибка при удалении {file_path}: {e}")
                        break
            
            print(f"Очистка папки {save_dir} завершена")
            
        except Exception as e:
            print(f"Критическая ошибка при очистке папки {save_dir}: {str(e)}")

    def get_status(self):
        with self.lock:
            return {
                "is_active": self.active,
                "camera_id": self.camera_id,
                "activity_id": self.activity_id,
                "rtsp_url": self.rtsp_url
            }

    def _process_rtsp_stream(self):
        try:
            # Создаем папку для сохранения изображений с проверкой прав
            save_dir = "cropped_images"
            try:
                os.makedirs(save_dir, exist_ok=True)
                test_file = os.path.join(save_dir, "test_write.tmp")
                with open(test_file, 'w') as f:
                    f.write("test")
                os.remove(test_file)
            except Exception as e:
                print(f"✗ Ошибка создания папки для изображений: {str(e)}")
                return
            
            # Получаем данные из БД
            events_mapping = self._get_events_mapping()
            pet_ids = self._get_pet_ids()
            
            if not events_mapping or not pet_ids:
                print("✗ Не удалось получить необходимые данные из БД")
                return

            # Проверяем соответствие описаний
            required_texts = [
                "the animal eats",
                "the animal is actively",
                "the animal is resting",
                "the animal goes to the toilet"
            ]
            
            missing_texts = [text for text in required_texts if text not in events_mapping]
            if missing_texts:
                print("✗ В таблице events_type отсутствуют следующие описания:")
                for text in missing_texts:
                    print(f"- '{text}'")
                return

            # Настройка обработки RTSP потока
            cap = cv2.VideoCapture(self.rtsp_url)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            frame_count = 0
            padding = 70
            processed_objects = 0
            last_processed_time = datetime.datetime.now()
            CONFIDENCE_THRESHOLD = 0.65

            while self.active:
                try:
                    ret, frame = cap.read()
                    if not ret:
                        print("✗ Ошибка чтения кадра из потока. Попытка переподключения...")
                        time.sleep(5)
                        cap.release()
                        cap = cv2.VideoCapture(self.rtsp_url)
                        continue

                    frame_count += 1
                    
                    current_time = datetime.datetime.now()
                    if (current_time - last_processed_time).seconds >= 2:
                        last_processed_time = current_time
                        
                        # Запускаем YOLO с трекингом (используем ByteTrack)
                        results = self.yolo_model.track(
                            source=frame, 
                            conf=CONFIDENCE_THRESHOLD, 
                            persist=True, 
                            tracker="bytetrack.yaml"
                        )
                        
                        current_ids = set()
                        boxes = results[0].boxes
                        if boxes is None:
                            continue

                        for obj in boxes:
                            # Получаем данные об объекте
                            track_id = int(obj.id[0]) if obj.id is not None else None
                            if track_id is None:
                                continue  # Пропускаем объекты без ID
                                
                            class_id = int(obj.cls[0])
                            confidence = float(obj.conf[0])
                            
                            # Обновляем класс с учетом стабилизации
                            fixed_class = self.class_fixer.update(track_id, class_id)
                            if fixed_class is None:
                                continue  # Пропускаем объекты без фиксированного класса
                            
                            current_ids.add(track_id)
                            
                            cls = self.yolo_model.names[fixed_class]
                            russian_type = 'кот' if cls == 'cat' else 'собака'
                            pets_id = pet_ids.get(russian_type)
                            
                            if not pets_id:
                                continue

                            # Обрезаем объект
                            x1, y1, x2, y2 = map(int, obj.xyxy[0])
                            x1, y1 = max(x1-padding, 0), max(y1-padding, 0)
                            x2, y2 = min(x2+padding, frame.shape[1]), min(y2+padding, frame.shape[0])
                            
                            # Проверяем валидность области обрезки
                            if x1 >= x2 or y1 >= y2:
                                print(f"✗ Некорректные координаты обрезки для {cls}")
                                continue
                                
                            crop = frame[y1:y2, x1:x2]
                            
                            # Сохраняем обрезанное изображение
                            try:
                                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                                base_filename = f"{timestamp}_frame{frame_count}_{cls}_{confidence:.2f}"
                                
                                # Основное сохранение (никогда не удаляется)
                                perm_filename = os.path.join(save_dir, f"perm_{base_filename}.jpg")
                                success = cv2.imwrite(perm_filename, crop)
                                
                                if not success:
                                    raise Exception("Ошибка cv2.imwrite()")
                                    
                                print(f"✓ Сохранено: {perm_filename} (размер: {crop.shape}, confidence: {confidence:.2f})")
                                
                                # Временная копия для LLM
                                temp_filename = os.path.join(save_dir, f"temp_{base_filename}.jpg")
                                cv2.imwrite(temp_filename, crop)
                                
                                # Получаем предсказание от LLM
                                predicted_idx, llm_confidence = self.llm.predict(temp_filename)
                                
                                # Удаляем временный файл после обработки
                                if os.path.exists(temp_filename):
                                    os.remove(temp_filename)
                                
                            except Exception as e:
                                print(f"✗ Ошибка сохранения: {str(e)}")
                                continue

                            if predicted_idx is None:
                                continue
                            
                            # Получаем текст действия
                            action_text = None
                            if predicted_idx == 1:
                                action_text = "the animal eats"
                            elif predicted_idx == 2:
                                action_text = "the animal is actively"
                            elif predicted_idx == 3:
                                action_text = "the animal is resting"
                            elif predicted_idx == 4:
                                action_text = "the animal goes to the toilet"
                            
                            if not action_text or action_text not in events_mapping:
                                continue

                            events_id = events_mapping[action_text]

                            # Логируем результат
                            log_msg = (f"Обнаружен {russian_type} (ID: {track_id}, доверие YOLO: {confidence:.2f}), "
                                    f"действие: {action_text} (ID: {events_id}, доверие LLM: {llm_confidence:.2f})")
                            print(log_msg)

                            # Записываем в БД
                            self._post_event(
                                activity_id=self.activity_id,
                                events_id=events_id,
                                pets_id=pets_id,
                                camera_id=self.camera_id
                            )
                            processed_objects += 1

                        # Обновляем возраст объектов
                        self.class_fixer.age_all(current_ids)

                except Exception as e:
                    print(f"✗ Ошибка при обработке потока: {str(e)}")
                    time.sleep(5)
                    continue

            cap.release()
            print(f"✓ Обработка потока завершена. Кадров: {frame_count}, объектов: {processed_objects}")

        except Exception as e:
            print(f"✗ Критическая ошибка в _process_rtsp_stream: {str(e)}")
        finally:
            with self.lock:
                self.active = False
                self.thread = None

    def _get_camera_rtsp_url(self, camera_id):
        with self.db.cursor() as cursor:
            cursor.execute("""
                SELECT camera_name, camera_pass, ip_camera, port_camera, stream 
                FROM cameras WHERE id = %s
            """, (camera_id,))
            cam = cursor.fetchone()
            if not cam:
                return None
            
            if cam['ip_camera'].lower() == 'localhost':
                return f"rtsp://{cam['ip_camera']}:{cam['port_camera']}/{cam['stream']}"
            return f"rtsp://{cam['camera_name']}:{cam['camera_pass']}@{cam['ip_camera']}:{cam['port_camera']}/{cam['stream']}"

    def _check_activity_exists(self, activity_id):
        with self.db.cursor() as cursor:
            cursor.execute("SELECT id FROM activity_log WHERE id = %s", (activity_id,))
            return cursor.fetchone() is not None

    def _get_events_mapping(self):
        with self.db.cursor() as cursor:
            cursor.execute("SELECT id, description FROM events_type")
            events = cursor.fetchall()
            return {event['description']: event['id'] for event in events} if events else None

    def _get_pet_ids(self):
        with self.db.cursor() as cursor:
            cursor.execute("SELECT id, animal_type FROM pets WHERE animal_type IN ('кот', 'собака')")
            pets = cursor.fetchall()
            return {pet['animal_type']: pet['id'] for pet in pets} if pets else None

    def _post_event(self, activity_id, events_id, pets_id, camera_id):
        with self.db.cursor() as cursor:
            cursor.execute("""
                INSERT INTO events (activity_id, events_id, pets_id, camera_id, date_create)
                VALUES (%s, %s, %s, %s, %s)
            """, (activity_id, events_id, pets_id, camera_id, datetime.datetime.now()))
            self.db.commit()

    def __del__(self):
        if hasattr(self, 'db') and self.db:
            self.db.close()