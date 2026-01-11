-- Seed default habits for new users
-- This migration ensures all users have the 10 default habits

INSERT INTO habits (id, name, target_minutes, category, skill_level, eisenhower_quadrant, is_weekday_only) VALUES
    (uuid_generate_v4(), 'Сон', 480, 'health', 3, 'Q2', false),
    (uuid_generate_v4(), 'Спорт', 60, 'health', 3, 'Q2', false),
    (uuid_generate_v4(), 'Английский', 60, 'skills', 2, 'Q2', false),
    (uuid_generate_v4(), 'Чтение', 30, 'learning', 3, 'Q2', false),
    (uuid_generate_v4(), 'Работа', 360, 'career', 4, 'Q1', true),
    (uuid_generate_v4(), 'Отдых', 180, 'recovery', 3, 'Q3', false),
    (uuid_generate_v4(), 'Права', 20, 'skills', 1, 'Q2', false),
    (uuid_generate_v4(), 'Блог в X', 20, 'content', 1, 'Q2', false),
    (uuid_generate_v4(), 'ИИ', 30, 'skills', 1, 'Q2', false),
    (uuid_generate_v4(), 'Аналитика', 30, 'skills', 3, 'Q2', false)
ON CONFLICT (name) DO NOTHING;