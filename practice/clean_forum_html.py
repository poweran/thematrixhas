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
import shutil
import hashlib
import os
try:
    import image_stitcher
except ImportError:
    image_stitcher = None
import urllib.request
import urllib.parse
from pathlib import Path
from html import unescape
from typing import Optional, List, Tuple

try:
    from bs4 import BeautifulSoup, NavigableString
except ImportError:
    print("Установите BeautifulSoup: pip install beautifulsoup4")
    sys.exit(1)


# Минимальный CSS для отображения
MINIMAL_CSS = """
body { font-family: Arial, sans-serif; background: #131833; color: #e0e0e0; line-height: 1.7; padding: 20px; max-width: 900px; margin: 0 auto; }
h1 { color: #FE99FE; text-align: center; }
.post { background: #1a1f3a; border-radius: 10px; padding: 20px; margin: 20px 0; }
.post-content { font-size: 14px; }
.post-content p { margin: 10px 0; }
img.postimg { max-width: 100%; height: auto; border-radius: 5px; }
img[title="float:right"] { float: right; padding-left: 12px; max-width: 40%; }
img[title="float:left"] { float: left; padding-right: 12px; max-width: 40%; }
.quote-box { background: rgba(0,0,0,0.3); border-left: 3px solid #FE99FE; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
.spoiler-box > div:first-child { cursor: pointer; color: #FE99FE; font-weight: bold; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; }
.spoiler-box > blockquote { display: none; padding: 15px; }
.spoiler-box.visible > blockquote { display: block; }
.clearer { clear: both; }
a { color: #FE99FE; }
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


def download_image(url: str, save_dir: Path) -> Optional[str]:
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



class ImageModernizer:
    """
    Класс для модернизации изображений.
    Может использовать API (например, Stability AI) или локальные модели.
    """
    def __init__(self, api_key=None, use_local=False):
        self.api_key = api_key
        self.use_local = use_local
        self.pipeline = None
        
        # Здесь можно настроить параметры стиля
        self.style_prompt = "modern clean aesthetic, high quality, 4k, detailed, professional photography, soft lighting"
        self.negative_prompt = "blurry, low quality, distorted, watermark, text, ugly"

    def _init_local_pipeline(self):
        """Инициализация локальной модели Stable Diffusion"""
        if self.pipeline:
            return

        print("  ⏳ Загрузка модели Stable Diffusion (это может занять время)...")
        try:
            import torch
            from diffusers import StableDiffusionImg2ImgPipeline
            
            model_id = "runwayml/stable-diffusion-v1-5"
            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32
            
            self.pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
                model_id, 
                torch_dtype=dtype,
                use_safetensors=True
            ).to(device)
            
            # Оптимизация памяти
            if device == "cuda":
                self.pipeline.enable_attention_slicing()
                
            self.device = device
            print(f"  ✅ Модель загружена на {device.upper()}")
            
        except ImportError:
            print("  ❌ Ошибка: Не установлены библиотеки для локальной работы.")
            print("  Пожалуйста, выполните: pip install torch diffusers transformers accelerate")
            self.use_local = False
        except Exception as e:
            print(f"  ❌ Ошибка загрузки модели: {e}")
            self.use_local = False

    def process(self, image_path: Path) -> Path:
        """
        Принимает путь к изображению, отправляет его на обработку
        и возвращает путь к новому файлу.
        """
        if not image_path.exists():
            return image_path

        # Пропускаем маленькие файлы или иконки
        if image_path.stat().st_size < 5000:
            return image_path
            
        print(f"  🎨 Модернизация: {image_path.name}...")
        
        # --- ЛОКАЛЬНАЯ ГЕНЕРАЦИЯ ---
        if self.use_local:
            # Проверяем кэш, чтобы не генерировать повторно
            modern_path = image_path.parent / f"modern_{image_path.stem}.png"
            if modern_path.exists():
                print(f"    ✨ Взято из кэша: {modern_path.name}")
                return modern_path

            self._init_local_pipeline()
            if self.pipeline:
                try:
                    from PIL import Image
                    init_image = Image.open(image_path).convert("RGB")
                    
                    # Изменение размера под требования SD (кратность 64)
                    w, h = init_image.size
                    w = max(64, round(w / 64) * 64)
                    h = max(64, round(h / 64) * 64)
                    init_image = init_image.resize((w, h))
                    
                    generator = torch.manual_seed(42) if 'torch' in locals() else None
                    
                    image = self.pipeline(
                        prompt=self.style_prompt,
                        negative_prompt=self.negative_prompt,
                        image=init_image,
                        strength=0.35, # Сила изменений (больше -> сильнее меняется)
                        guidance_scale=7.5,
                        num_inference_steps=30,
                        generator=generator
                    ).images[0]
                    
                    modern_path = image_path.parent / f"modern_{image_path.stem}.png"
                    image.save(modern_path)
                    print(f"    ✨ Сохранено: {modern_path.name}")
                    return modern_path
                    
                except Exception as e:
                    print(f"  ⚠ Ошибка локальной генерации: {e}")
                    return image_path
            else:
                 # Если инициализация не удалась, возвращаем оригинал
                 return image_path

        # --- ВАРИАНТ: STABILITY AI API ---
        # Подробнее: https://platform.stability.ai/docs/api-reference#tag/v1generation/operation/imageToImage
        if self.api_key:
            import requests
            url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image"
            
            try:
                response = requests.post(
                    url,
                    headers={
                        "Accept": "application/json",
                        "Authorization": f"Bearer {self.api_key}"
                    },
                    files={
                        "init_image": open(image_path, "rb")
                    },
                    data={
                        "init_image_mode": "IMAGE_STRENGTH",
                        "image_strength": 0.35, 
                        "text_prompts[0][text]": self.style_prompt,
                        "text_prompts[0][weight]": 1,
                        "text_prompts[1][text]": self.negative_prompt,
                        "text_prompts[1][weight]": -1,
                        "samples": 1,
                        "steps": 30,
                    }
                )
                
                if response.status_code != 200:
                    print(f"  ⚠ Ошибка API: {response.text}")
                    return image_path

                data = response.json()
                import base64
                
                for i, image in enumerate(data.get("artifacts", [])):
                    modern_path = image_path.parent / f"modern_{image_path.stem}.png"
                    with open(modern_path, "wb") as f:
                        f.write(base64.b64decode(image["base64"]))
                    return modern_path

            except Exception as e:
                print(f"  ⚠ Ошибка обработки через API: {e}")
                return image_path
        
        # Если ничего не выбрано - просто заглушка (возвращаем оригинал)
        return image_path


def process_images(post_content, files_dir: Path, files_dir_name: str, modernizer: ImageModernizer = None) -> int:
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
        
        # Если URL уже локальный - оставляем (или модернизируем если это старый локальный файл?)
        # В данном контексте скрипт запускается один раз, так что локальные - это результат скачивания
        if src and not src.startswith(('http://', 'https://')):
            # Если файл уже локальный, и включена модернизация
            if modernizer:
                # Пытаемся найти файл относительно HTML файла
                # files_dir.parent - это папка где лежит HTML
                local_path = (files_dir.parent / src)
                
                if local_path.exists():
                     processed_path = modernizer.process(local_path)
                     
                     if processed_path != local_path:
                         # Вычисляем новый относительный путь для src
                         try:
                             # Если файл в той же подпапке
                             new_src = processed_path.relative_to(files_dir.parent)
                             img['src'] = str(new_src)
                         except ValueError:
                             # Если что-то пошло не так с путями, оставляем как есть
                             pass
            continue
        
        if not url:
            img.decompose()  # Нет валидного URL - удаляем
            continue
        
        # Пробуем скачать
        local_filename = download_image(url, files_dir)
        
        if local_filename:
            local_path = files_dir / local_filename
            
            # МОДЕРНИЗАЦИЯ
            if modernizer:
                processed_path = modernizer.process(local_path)
                # Если путь изменился (создан новый файл), используем его имя
                if processed_path != local_path:
                    local_filename = processed_path.name

            # Успешно - обновляем src
            img['src'] = f"{files_dir_name}/{local_filename}"
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


def batch_modernize_directory(directory: Path, modernizer: ImageModernizer):
    """
    Пакетная обработка изображений через атлас.
    """
    if not image_stitcher:
        return

    # Проверяем наличие изображений
    extensions = ('.jpg', '.jpeg', '.png', '.webp')
    images = [f for f in directory.iterdir() if f.suffix.lower() in extensions]
    if not images:
        return

    print(f"  🚀 Пакетная модернизация {len(images)} файлов в {directory.name}...")
    
    atlas_path = directory / "temp_atlas_processing.png"
    meta_path = directory / "temp_atlas_processing.json"
    
    # 1. Склейка
    try:
        image_stitcher.stitch_images(str(directory), str(atlas_path), str(meta_path))
    except Exception as e:
        print(f"  ⚠ Ошибка склейки: {e}")
        return

    if not atlas_path.exists():
        return

    # 2. Модернизация
    processed_atlas = modernizer.process(atlas_path)
    
    # 3. Расклейка
    if processed_atlas and processed_atlas.exists():
        print(f"  ✂ Расклейка обновленного атласа...")
        # Используем unstitch_images из модуля
        # Важно: unstitch перезапишет файлы, если они совпадают по именам в метаданных
        try:
            image_stitcher.unstitch_images(str(processed_atlas), str(meta_path))
            print("  ✅ Пакетная обработка завершена.")
        except Exception as e:
            print(f"  ⚠ Ошибка расклейки: {e}")

    # 4. Очистка
    try:
        if atlas_path.exists(): os.remove(atlas_path)
        if meta_path.exists(): os.remove(meta_path)
        if processed_atlas != atlas_path and processed_atlas.exists():
            os.remove(processed_atlas)
    except Exception as e:
        print(f"  ⚠ Ошибка очистки временных файлов: {e}")



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
    
    # Инициализация модернизатора
    import os
    modernizer_api_key = os.environ.get("STABILITY_API_KEY")
    # Простейшая проверка аргумента командной строки для включения локального режим (для теста)
    use_local = "--local" in sys.argv
    modernizer = ImageModernizer(api_key=modernizer_api_key, use_local=use_local)

    # Определяем режим работы (поштучный или пакетный)
    use_batch = use_local and (image_stitcher is not None)
    
    # Если пакетный режим - в цикле не обрабатываем (передаем None)
    loop_modernizer = None if use_batch else modernizer

    for post in posts:
        post_content = post.find('div', class_='post-content')
        if post_content:
            # 1. ОБРАБАТЫВАЕМ ИЗОБРАЖЕНИЯ (скачиваем)
            total_images += process_images(post_content, files_dir, files_dir_name, loop_modernizer)
            
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
    
    output_file.write_text(clean_html, encoding='utf-8')
    
    if total_images:
        print(f"  📷 Скачано {total_images} изображений в {files_dir_name}/")
        
    # Если пакетный режим и есть что обрабатывать
    if use_batch and files_dir.exists():
        batch_modernize_directory(files_dir, modernizer)
    
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


def merge_forum_pages(directory: str):
    """
    Находит в директории группы файлов (например Name.html, Name2.html...)
    и объединяет их в один файл с разделителем.
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise NotADirectoryError(f"Не директория: {directory}")

    # 1. Группируем файлы
    # Ключ: базовое имя, Значение: список (номер, путь)
    groups = {}
    
    # Регулярка для поиска: ИмяФайла + (цифра) + .html
    # Пример: "Topic" + "" + ".html" -> номер 1
    # "Topic" + "2" + ".html" -> номер 2
    # Используем жадный захват для имени, чтобы цифра в конце попала в группу 2 только если она перед .html
    pattern = re.compile(r"^(.+?)(?:(\d+))?\.html$")
    
    files = [f for f in dir_path.glob("*.html") if not f.name.endswith('.bak') and not f.name.endswith('_merged.html')]
    
    for f in files:
        match = pattern.match(f.name)
        if match:
            base_name = match.group(1)
            # Если база заканчивается на дефис или пробел, оставляем как есть, это часть имени
            suffix = match.group(2)
            
            # Особая обработка: часто бывает "Name.html" и "Name2.html".
            # Если suffix пусто, считаем это 1
            num = int(suffix) if suffix else 1
            
            if base_name not in groups:
                groups[base_name] = []
            groups[base_name].append((num, f))

    # 2. Обрабатываем группы
    count_merged = 0
    for base_name, file_list in groups.items():
        if len(file_list) < 2:
            continue
            
        # Сортируем по номеру
        file_list.sort(key=lambda x: x[0])
        
        print(f"Объединение группы '{base_name}': {[f.name for n, f in file_list]}")
        
        try:
            # Читаем первый файл (основной)
            first_num, first_path = file_list[0]
            
            # Определяем кодировку и читаем
            content = None
            for encoding in ['utf-8', 'windows-1251', 'cp1251']:
                try:
                    content = first_path.read_text(encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if not content:
                print(f"  ⚠ Не удалось прочитать {first_path.name}")
                continue

            soup = BeautifulSoup(content, 'html.parser')
            body = soup.find('body')
            if not body:
                print(f"  ⚠ Нет body в {first_path.name}")
                continue
                
            # Ищем место для вставки (после последнего div.post или просто в конец)
            last_post = None
            posts = body.find_all('div', class_='post')
            if posts:
                last_post = posts[-1]
            
            # Читаем остальные файлы и добавляем
            for num, path in file_list[1:]:
                # Читаем файл-продолжение
                sub_content = None
                for encoding in ['utf-8', 'windows-1251', 'cp1251']:
                    try:
                        sub_content = path.read_text(encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                        
                if not sub_content:
                    continue
                    
                sub_soup = BeautifulSoup(sub_content, 'html.parser')
                sub_posts = sub_soup.find_all('div', class_='post')
                
                if not sub_posts:
                    # Если постов нет, может там просто контент в body?
                    # Берем всё из body кроме script
                    if sub_soup.body:
                        # Упрощение: считаем что контент полезный
                        pass
                
                if sub_posts:
                    # Создаем разделитель
                    separator = soup.new_tag('hr')
                    separator['style'] = "border: 0; height: 1px; background: #FE99FE; opacity: 0.1; margin: 50px 0;"
                    separator['class'] = "page-separator"
                    
                    header_sep = soup.new_tag('div')
                    header_sep['style'] = "text-align: center; color: #444; font-size: 12px; margin-bottom: 20px;"
                    header_sep.string = f"--- Страница {num} ---"
                    
                    # Вставляем разделитель в конец body (или после последнего поста)
                    body.append(separator)
                    body.append(header_sep)
                    
                    # Добавляем посты
                    for post in sub_posts:
                        # Импортируем ноду в основной документ (BS4 делает это автоматически при вставке)
                        body.append(post)
                        # Добавляем перенос строки для красоты
                        body.append(NavigableString("\n\n"))
            
            # Сохраняем в новый файл
            output_name = first_path.stem + "_merged.html"
            
            # --- КОНСОЛИДАЦИЯ ИЗОБРАЖЕНИЙ ---
            merged_files_dir_name = Path(output_name).stem + "_files"
            merged_files_dir = dir_path / merged_files_dir_name
            merged_files_dir.mkdir(exist_ok=True)
            
            count_images = 0
            for img in soup.find_all('img'):
                src = img.get('src')
                if not src or src.startswith(('http://', 'https://', 'data:')):
                    continue
                
                # Ищем исходный файл
                # src обычно "Name_files/img.jpg", путь относительно html
                original_path = dir_path / src
                
                if original_path.exists() and original_path.is_file():
                    # Копируем в новую папку
                    new_filename = original_path.name
                    destination = merged_files_dir / new_filename
                    
                    if not destination.exists():
                        try:
                            shutil.copy2(original_path, destination)
                        except Exception as e:
                            print(f"    ⚠ Ошибка копирования {new_filename}: {e}")
                            continue

                    # Обновляем ссылку
                    img['src'] = f"{merged_files_dir_name}/{new_filename}"
                    count_images += 1
            
            output_path = dir_path / output_name
            output_path.write_text(str(soup), encoding='utf-8')
            print(f"  ✓ Создан: {output_name} ({output_path.stat().st_size/1024:.1f} KB)")
            if count_images:
                print(f"    📷 Скопировано {count_images} изображений в {merged_files_dir_name}/")
            count_merged += 1
            
        except Exception as e:
            print(f"  ✗ Ошибка при объединении: {e}")
            import traceback
            traceback.print_exc()

    if count_merged == 0:
        print("Групп файлов для объединения не найдено.")
    else:
        print(f"Всего объединено групп: {count_merged}")



if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("""
Использование:
  python clean_forum_html.py <файл.html> [опции]          # Очистить один файл
  python clean_forum_html.py <директория> [опции]         # Очистить все .html в папке
  python clean_forum_html.py <файл.html> <выход> [опции]  # Сохранить в другой файл
        
Опции:
  --merge   Объединить группы файлов (Name.html + Name2.html)
  --local   Использовать локальную генерацию изображений (Stable Diffusion)
        
Примеры:
  python clean_forum_html.py pages/ --local
  python clean_forum_html.py --merge pages/
""")
        sys.exit(1)
    
    # Разделяем флаги и позиционные аргументы
    args = sys.argv[1:]
    flags = [a for a in args if a.startswith('--')]
    positional = [a for a in args if not a.startswith('--')]
    
    if not positional:
         print("✗ Не указан целевой файл или директория")
         sys.exit(1)
         
    target = positional[0]
    
    if '--merge' in flags:
        merge_forum_pages(target)
    elif Path(target).is_dir():
        process_directory(target)
    elif Path(target).is_file():
        output = positional[1] if len(positional) > 1 else None
        result = clean_forum_html(target, output)
        print(f"✓ Сохранено: {result}")
    else:
        print(f"✗ Не найдено: {target}")
        sys.exit(1)
