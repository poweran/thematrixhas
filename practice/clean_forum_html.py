#!/usr/bin/env python3
"""
Скрипт для очистки сохранённых HTML страниц форума aum.mybb.ru

Удаляет:
- Все JavaScript скрипты
- CSS стили форума
- Рекламу (Yandex RTB и др.)
- Навигацию, формы, меню
- Метаданные пользователя
- Имена участников форума
- Информацию об авторе поста

Сохраняет:
- Текст постов
- Изображения (скачивает и сохраняет локально)
- Спойлеры и цитаты (без имён)
- Форматирование текста
"""

import re
import sys
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path
from html import unescape

try:
    from bs4 import BeautifulSoup, NavigableString
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
.spoiler-box > div:first-child { cursor: pointer; color: #99FEFE; font-weight: bold; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; }
.spoiler-box > blockquote { display: none; padding: 15px; }
.spoiler-box.visible > blockquote { display: block; }
.clearer { clear: both; }
a { color: #99FEFE; }
.broken-link { color: #FF6666; text-decoration: underline dotted; cursor: help; }
"""


def fix_image_url(url: str) -> str:
    """
    Исправить битый URL изображения.
    - &amp; → удаляется (для Google Drive ?&id= → ?id=)
    - Исправляет http → https
    """
    if not url:
        return url
    
    # Декодируем HTML entities (&amp; → &)
    url = unescape(url)
    
    # Убираем лишний & после ? (Google Drive: ?&id= → ?id=)
    url = url.replace('?&', '?')
    
    # Убираем двойные амперсанды
    url = re.sub(r'&+', '&', url)
    
    # http → https
    if url.startswith('http://'):
        url = url.replace('http://', 'https://', 1)
    
    return url


def download_image(url: str, save_dir: Path) -> str | None:
    """
    Скачать изображение по URL и сохранить в папку.
    Возвращает локальный путь или None при ошибке.
    """
    try:
        # Генерируем имя файла из URL
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        
        # Определяем расширение
        parsed = urllib.parse.urlparse(url)
        path_ext = Path(parsed.path).suffix.lower()
        if path_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
            ext = path_ext
        else:
            ext = '.jpg'  # По умолчанию
        
        filename = f"img_{url_hash}{ext}"
        save_path = save_dir / filename
        
        # Если уже скачано - не качаем повторно
        if save_path.exists():
            return filename
        
        # Создаём папку если нет
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Скачиваем
        headers = {'User-Agent': 'Mozilla/5.0'}
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read()
            
            # Проверяем что это изображение
            content_type = response.headers.get('Content-Type', '')
            if 'image' not in content_type and len(content) < 100:
                return None
            
            save_path.write_bytes(content)
            return filename
            
    except Exception as e:
        print(f"  ⚠ Не удалось скачать {url[:50]}...: {e}")
        return None


def process_images(post_content, files_dir: Path, files_dir_name: str) -> int:
    """
    Обработать все изображения в посте.
    Возвращает количество успешно скачанных.
    """
    downloaded = 0
    
    for img in post_content.find_all('img'):
        # Получаем URL (из src или alt)
        src = img.get('src', '')
        alt = img.get('alt', '')
        
        # Пробуем разные источники URL
        url = None
        for candidate in [src, alt]:
            if candidate and (candidate.startswith('http://') or candidate.startswith('https://')):
                url = fix_image_url(candidate)
                break
        
        # Если URL уже локальный - оставляем
        if src and not src.startswith('http'):
            continue
        
        if not url:
            img.decompose()  # Нет валидного URL - удаляем
            continue
        
        # Пробуем скачать
        local_file = download_image(url, files_dir)
        
        if local_file:
            # Успешно - обновляем src
            img['src'] = f"{files_dir_name}/{local_file}"
            img['loading'] = 'lazy'
            img['class'] = 'postimg'
            # Убираем ненужные атрибуты
            for attr in ['alt', 'data-src', 'onclick']:
                if attr in img.attrs:
                    del img.attrs[attr]
            downloaded += 1
        else:
            # Не удалось скачать - удаляем тег
            img.decompose()
    
    return downloaded


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
    
    # Папка для изображений
    files_dir_name = input_file.stem + "_files"
    files_dir = input_file.parent / files_dir_name
    
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
    title = re.sub(r'\s*¤\w*¤\s*', '', title).strip()
    
    # Находим все посты
    posts = soup.find_all('div', class_='post')
    
    if not posts:
        topic_div = soup.find('div', id=lambda x: x and x.startswith('topic_'))
        if topic_div:
            posts = topic_div.find_all('div', class_='post')
    
    # Извлекаем контент постов
    cleaned_posts = []
    total_images = 0
    
    for post in posts:
        post_content = post.find('div', class_='post-content')
        if post_content:
            # 1. ОБРАБАТЫВАЕМ ИЗОБРАЖЕНИЯ (скачиваем)
            total_images += process_images(post_content, files_dir, files_dir_name)
            
            # 2. УДАЛЯЕМ ИМЕНА АВТОРОВ ЦИТАТ
            for cite in post_content.find_all('cite'):
                cite.decompose()
            
            # 3. УДАЛЯЕМ "Отредактировано..."
            for p in post_content.find_all('p', class_='lastedit'):
                p.decompose()
            
            # 4. УДАЛЯЕМ "Пост X из Y" маркеры
            for span in post_content.find_all('span'):
                text = span.get_text()
                if re.match(r'Пост\s+\d+\s+из\s+\d+', text):
                    span.decompose()
            
            # 5. Обрабатываем ссылки
            for a in post_content.find_all('a'):
                href = a.get('href', '')
                # Удаляем технические ссылки
                if href.startswith('javascript:') or 'PostBgColor' in href or 'PhrasesBgcolor' in href:
                    a.replace_with(a.get_text())
                # Внешние ссылки на форум - помечаем классом
                elif 'aum.mybb.ru' in href:
                    a.attrs = {'class': 'broken-link', 'data-original-href': href}
                else:
                    a.attrs = {'href': href} if href and not href.startswith('javascript:') else {}
            
            # 6. Добавляем onclick для спойлеров
            for spoiler in post_content.find_all('div', class_='spoiler-box'):
                spoiler['onclick'] = "this.classList.toggle('visible')"
            
            # 7. Удаляем пустые теги
            for tag in post_content.find_all(['p', 'span', 'div']):
                if not tag.get_text(strip=True) and not tag.find_all():
                    tag.decompose()
            
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
    
    if total_images:
        print(f"  📷 Скачано {total_images} изображений в {files_dir_name}/")
    
    return str(output_file)


def process_directory(directory: str, pattern: str = "*.html"):
    """
    Обработать все HTML файлы в директории.
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise NotADirectoryError(f"Не директория: {directory}")
    
    html_files = [f for f in dir_path.glob(pattern) if not f.name.endswith('.bak')]
    print(f"Найдено {len(html_files)} файлов для обработки")
    
    for html_file in html_files:
        try:
            # Создаём backup
            backup = html_file.with_suffix('.html.bak')
            if not backup.exists():
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
