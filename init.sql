-- 1. Создаем базу данных (если не существует)
CREATE DATABASE IF NOT EXISTS pet_monitoring_system;
USE pet_monitoring_system;

-- Включаем планировщик событий (добавляем эту строку)
SET GLOBAL event_scheduler = ON;

-- 2. Создаем таблицу activity_log (для внешнего ключа events.activity_id)
CREATE TABLE IF NOT EXISTS activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    record_date DATETIME DEFAULT NULL
);

-- 3. Создаем таблицу pets (для внешнего ключа events.pets_id)
CREATE TABLE IF NOT EXISTS pets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    animal_type VARCHAR(50),
    year YEAR(4),
    breed VARCHAR(100),
    image VARCHAR(255),
    created_at DATETIME DEFAULT NULL
);

-- 4. Создаем таблицу cameras (для внешнего ключа events.camera_id)
CREATE TABLE IF NOT EXISTS cameras (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room VARCHAR(255),
    camera_name VARCHAR(100),
    camera_pass VARCHAR(100),
    ip_camera VARCHAR(100),
    port_camera INT(100),
    stream VARCHAR(100)
);

-- 5. Создаем таблицу events_type (для внешнего ключа events.events_id)
CREATE TABLE IF NOT EXISTS events_type (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL,
    description TEXT
);

-- 6. Создаем таблицу events (основная таблица)
CREATE TABLE IF NOT EXISTS events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    activity_id INT,
    pets_id INT,
    camera_id INT,
    events_id INT,
    date_create DATETIME DEFAULT NULL,
    
    FOREIGN KEY (activity_id) REFERENCES activity_log(id) 
        ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (pets_id) REFERENCES pets(id) 
        ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) 
        ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (events_id) REFERENCES events_type(id) 
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- 7. Заполнение начальными значениями таблицы events_type
INSERT INTO events_type (type_name, description) VALUES 
('кормление', 'the animal eats'),
('активность', 'the animal is actively'),
('отдых', 'the animal is resting'),
('туалет', 'the animal goes to the toilet');

-- 8. Создание процедуры очистки таблицы events
DELIMITER //
CREATE PROCEDURE pet_monitoring_system.clear_events()
BEGIN
    TRUNCATE TABLE events;
END//
DELIMITER ;

-- 9. Создание события, которое запускает процедуру
CREATE EVENT IF NOT EXISTS `daily_events_cleanup`
ON SCHEDULE
    EVERY 1 MONTH
    STARTS CONCAT(CURRENT_DATE, ' 23:59:59') -- Сегодня в 23:59:59
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Ежедневная очистка таблицы events в 23:59:59'
DO
    CALL `clear_events`();
    
-- 10. Фильтрация после ранжирования (для классов событий: ест и туалет) и создание на основе этого сводной таблицы (view)
CREATE OR REPLACE VIEW eat_and_toilet AS 
WITH grouped_data AS (
    SELECT 
        *,
        SUM(is_new_group) OVER (ORDER BY id) AS group_id
    FROM (
        SELECT 
            *,
            CASE 
                WHEN LAG(CONCAT(activity_id, pets_id, events_id)) OVER (ORDER BY id) 
                     <> CONCAT(activity_id, pets_id, events_id) 
                THEN 1 
                ELSE 0 
            END AS is_new_group
        FROM `events`
    ) t
),
ranked_data AS (
    SELECT 
        id,
        activity_id,
        pets_id,
        events_id,
        date_create,
        ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY id) AS rank
    FROM grouped_data
)
SELECT 
    id,
    activity_id,
    pets_id,
    events_id,
    date_create,
    rank
FROM ranked_data
WHERE 
    rank = 1 
    AND events_id IN (1, 4)
ORDER BY id;

-- 11. Фильтрация после ранжирования (для классов событий: отдых и активность) и создание на основе этого сводной таблицы (view)
CREATE OR REPLACE VIEW rest_and_activity AS 
WITH grouped_data AS (
    SELECT 
        *,
        SUM(is_new_group) OVER (ORDER BY id) AS group_id
    FROM (
        SELECT 
            *,
            CASE 
                WHEN LAG(CONCAT(activity_id, pets_id, events_id)) OVER (ORDER BY id) 
                     <> CONCAT(activity_id, pets_id, events_id) 
                THEN 1 
                ELSE 0 
            END AS is_new_group
        FROM `events`
        WHERE events_id IN (2, 3)
    ) t
)
SELECT 
    MIN(id) AS first_event_id,
    activity_id,
    pets_id,
    events_id,
    COUNT(*) AS events_in_window,
    MIN(date_create) AS window_start,
    MAX(date_create) AS window_end,
    TIMESTAMPDIFF(SECOND, MIN(date_create), MAX(date_create)) AS duration_minutes
FROM grouped_data
GROUP BY group_id, activity_id, pets_id, events_id
ORDER BY first_event_id;

-- 12. Сколько раз животное принимало пищу и ходило в туалет 
CREATE OR REPLACE VIEW results_eat_and_toilet AS 
SELECT 
    DATE_FORMAT(date_create, '%Y-%m-%d') AS date,
    activity_id,
    pets_id,
    events_id,
    COUNT(rank) AS count
FROM `eat_and_toilet`
GROUP BY 
    DATE_FORMAT(date_create, '%Y-%m-%d'),
    activity_id, 
    pets_id, 
    events_id;

-- 13. Сколько суммарно минут животное отдыхало или активничало
CREATE OR REPLACE VIEW results_reast_and_activity AS
SELECT 
    CAST(window_start AS DATE) AS date_monitoring,
    activity_id,
    pets_id,
    events_id,
    CEIL(SUM(duration_minutes)/60) AS minutes
FROM `rest_and_activity`
GROUP BY 
    CAST(window_start AS DATE),
    activity_id, 
    pets_id, 
    events_id;
