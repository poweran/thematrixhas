#!/usr/bin/env python3
"""
Скрипт для очистки сохранённых HTML страниц форума aum.mybb.ru

Удаляет:
- Все JavaScript скрипты
- CSS стили форума
- Рекламу (Yandex RTB и др.)
- Навигацию, формы, меню
- Метаданные пользователя

Сохраняет:
- Контент постов (текст, изображения)
- Спойлеры и цитаты
- Форматирование текста
"""

import re
import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Установите BeautifulSoup: pip install beautifulsoup4")
    sys.exit(1)


# Минимальный CSS для отображения
MINIMAL_CSS = """
body { font-family: Arial, sans-serif; background: #131833; color: #e0e0e0; line-height: 1.7; padding: 20px; max-width: 900px; margin: 0 auto; }
h1 { color: #99FEFE; text-align: center; }
.post { background: #1a1f3a; border-radius: 10px; padding: 20px; margin: 20px 0; }
.post-content { font-size: 14px; }
.post-content p { margin: 10px 0; }
img.postimg { max-width: 100%; height: auto; border-radius: 5px; }
img[title="float:right"] { float: right; padding-left: 12px; max-width: 40%; }
img[title="float:left"] { float: left; padding-right: 12px; max-width: 40%; }
.quote-box { background: rgba(0,0,0,0.3); border-left: 3px solid #99FEFE; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
.quote-box cite { color: #888; display: block; margin-bottom: 10px; }
.spoiler-box > div:first-child { cursor: pointer; color: #99FEFE; font-weight: bold; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; }
.spoiler-box > blockquote { display: none; padding: 15px; text-align: center; }
.spoiler-box.visible > blockquote { display: block; }
.clearer { clear: both; }
a { color: #99FEFE; }
"""


def clean_forum_html(input_path: str, output_path: str = None) -> str:
    """
    Очистить HTML файл форума от мусора.
    
    Args:
        input_path: Путь к исходному HTML файлу
        output_path: Путь для сохранения (если None - перезаписать исходный)
    
    Returns:
        Путь к очищенному файлу
    """
    input_file = Path(input_path)
    if not input_file.exists():
        raise FileNotFoundError(f"Файл не найден: {input_path}")
    
    # Читаем файл (пробуем разные кодировки)
    content = None
    for encoding in ['utf-8', 'windows-1251', 'cp1251', 'latin-1']:
        try:
            content = input_file.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    
    if content is None:
        raise ValueError(f"Не удалось прочитать файл с известной кодировкой")
    
    # Парсим HTML
    soup = BeautifulSoup(content, 'html.parser')
    
    # Извлекаем заголовок
    title_tag = soup.find('title')
    title = title_tag.get_text() if title_tag else "Без названия"
    # Убираем маркеры типа ¤c¤
    title = re.sub(r'\s*¤\w*¤\s*', '', title).strip()
    
    # Находим все посты
    posts = soup.find_all('div', class_='post')
    
    if not posts:
        # Попробуем найти по id
        topic_div = soup.find('div', id=lambda x: x and x.startswith('topic_'))
        if topic_div:
            posts = topic_div.find_all('div', class_='post')
    
    # Извлекаем контент постов
    cleaned_posts = []
    for post in posts:
        post_content = post.find('div', class_='post-content')
        if post_content:
            # Удаляем ненужные атрибуты из ссылок
            for a in post_content.find_all('a'):
                # Удаляем javascript: ссылки
                href = a.get('href', '')
                if href.startswith('javascript:') or 'PostBgColor' in href or 'PhrasesBgcolor' in href:
                    # Сохраняем только текст
                    a.replace_with(a.get_text())
                else:
                    # Убираем rel="nofollow ugc" и target
                    a.attrs = {'href': href} if href and not href.startswith('javascript:') else {}
            
            # Добавляем loading="lazy" к изображениям
            for img in post_content.find_all('img'):
                img['loading'] = 'lazy'
                # Исправляем http на https
                src = img.get('src', '')
                if src.startswith('http://'):
                    img['src'] = src.replace('http://', 'https://', 1)
            
            # Добавляем onclick для спойлеров
            for spoiler in post_content.find_all('div', class_='spoiler-box'):
                spoiler['onclick'] = "this.classList.toggle('visible')"
            
            cleaned_posts.append(str(post_content))
    
    # Собираем чистый HTML
    clean_html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
{MINIMAL_CSS}
    </style>
</head>
<body>

<h1>{title}</h1>

"""
    
    for i, post_html in enumerate(cleaned_posts, 1):
        clean_html += f"""<!-- Пост {i} -->
<div class="post">
{post_html}
</div>

"""
    
    clean_html += """</body>
</html>
"""
    
    # Сохраняем
    output_file = Path(output_path) if output_path else input_file
    output_file.write_text(clean_html, encoding='utf-8')
    
    return str(output_file)


def process_directory(directory: str, pattern: str = "*.html"):
    """
    Обработать все HTML файлы в директории.
    
    Args:
        directory: Путь к директории
        pattern: Шаблон файлов (по умолчанию *.html)
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise NotADirectoryError(f"Не директория: {directory}")
    
    html_files = list(dir_path.glob(pattern))
    print(f"Найдено {len(html_files)} файлов для обработки")
    
    for html_file in html_files:
        try:
            # Создаём backup
            backup = html_file.with_suffix('.html.bak')
            if not backup.exists():
                html_file.rename(backup)
                backup.rename(html_file)  # Возвращаем оригинал
                import shutil
                shutil.copy(html_file, backup)
            
            # Очищаем
            result = clean_forum_html(str(html_file))
            
            # Статистика
            original_size = backup.stat().st_size
            new_size = Path(result).stat().st_size
            reduction = (1 - new_size / original_size) * 100
            
            print(f"✓ {html_file.name}: {original_size/1024:.1f}KB → {new_size/1024:.1f}KB ({reduction:.0f}% уменьшение)")
        
        except Exception as e:
            print(f"✗ {html_file.name}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("""
Использование:
  python clean_forum_html.py <файл.html>           # Очистить один файл
  python clean_forum_html.py <директория>          # Очистить все .html в папке
  python clean_forum_html.py <файл.html> <выход>   # Сохранить в другой файл
        
Примеры:
  python clean_forum_html.py index.html
  python clean_forum_html.py ./pages/
  python clean_forum_html.py raw.html clean.html
""")
        sys.exit(1)
    
    target = sys.argv[1]
    
    if Path(target).is_dir():
        process_directory(target)
    elif Path(target).is_file():
        output = sys.argv[2] if len(sys.argv) > 2 else None
        result = clean_forum_html(target, output)
        print(f"✓ Сохранено: {result}")
    else:
        print(f"✗ Не найдено: {target}")
        sys.exit(1)
