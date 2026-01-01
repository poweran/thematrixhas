import os
import json
import argparse
import math
from PIL import Image, ImageDraw

def stitch_images(source_dir, output_image_path, output_meta_path):
    """
    Склеивает изображения из указанной директории в один файл с сеткой.
    Сохраняет метаданные для последующего восстановления.
    """
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')
    files = [f for f in os.listdir(source_dir) if f.lower().endswith(valid_extensions)]
    # Сортируем для детерминированного порядка
    files.sort()
    
    if not files:
        print(f"В директории {source_dir} изображения не найдены.")
        return

    images = []
    print(f"Найдено {len(files)} изображений. Загрузка...")
    
    for f in files:
        path = os.path.join(source_dir, f)
        try:
            img = Image.open(path)
            # Приводим к RGBA для поддержки прозрачности, если понадобится
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            images.append({'path': os.path.abspath(path), 'img': img, 'filename': f})
        except Exception as e:
            print(f"Ошибка загрузки {f}: {e}")

    if not images:
        return

    # --- НАСТРОЙКИ ---
    PADDING = 20  # Отступ между изображениями (px)
    DRAW_GUIDES = True # Рисовать красную рамку вокруг
    
    # Определяем размеры ячеек
    max_w = max(i['img'].width for i in images)
    max_h = max(i['img'].height for i in images)
    
    # Размер ячейки сетки (с учетом отступов для безопасности при редактировании)
    # Картинка будет в центре ячейки, окруженная PADDING
    cell_w = max_w + (PADDING * 2)
    cell_h = max_h + (PADDING * 2)
    
    # Вычисляем размеры сетки
    count = len(images)
    cols = math.ceil(math.sqrt(count))
    rows = math.ceil(count / cols)
    
    # Создаем холст
    canvas_w = cols * cell_w
    canvas_h = rows * cell_h
    
    # Создаем прозрачный фон
    stitched = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    
    # Инициализируем рисование (для рамок и маркеров)
    draw = ImageDraw.Draw(stitched)

    # --- МАРКЕРЫ УГЛОВ (Corner Markers) ---
    # Помогают редакторам понять границы холста и не делать auto-crop
    # Рисуем почти прозрачные пиксели в углах
    stitched.putpixel((0, 0), (0, 0, 0, 1))
    stitched.putpixel((canvas_w - 1, canvas_h - 1), (0, 0, 0, 1))
    
    meta_data = {
        "canvas_size": [canvas_w, canvas_h],
        "items": []
    }
    
    print(f"Создание атласа {canvas_w}x{canvas_h} для {count} изображений...")
    print(f"Отступ: {PADDING}px. Красные рамки показывают безопасную зону.")
    
    for idx, item in enumerate(images):
        col = idx % cols
        row = idx // cols
        
        # Координаты ячейки
        cell_x = col * cell_w
        cell_y = row * cell_h
        
        # Координаты картинки внутри ячейки (по центру или с фиксированным отступом)
        # Сделаем фиксированный отступ PADDING
        img_x = cell_x + PADDING
        img_y = cell_y + PADDING
        w = item['img'].width
        h = item['img'].height
        
        # Вставляем изображение
        # Используем маску из самого изображения, если есть альфа канал, чтобы корректно наложить
        stitched.paste(item['img'], (img_x, img_y))
        
        if DRAW_GUIDES:
            # Рисуем красную рамку ВОКРУГ изображения (в зоне padding), не касаясь самого изображения
            # img_x - 1 -> левая граница рамки (вне картинки)
            # img_x + w -> правая граница рамки (вне картинки, так как координаты 0-indexed)
            rect = [img_x - 1, img_y - 1, img_x + w, img_y + h]
            draw.rectangle(rect, outline=(255, 0, 0, 200), width=1)

        meta_data["items"].append({
            'original_path': item['path'],
            'filename': item['filename'],
            # Сохраняем координаты контента
            'box': [img_x, img_y, w, h] 
        })
    
    # Сохраняем результат
    stitched.save(output_image_path)
    
    # Сохраняем метаданные
    with open(output_meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_data, f, indent=4, ensure_ascii=False)
        
    print(f"Успешно! Атлас сохранен: {output_image_path}")
    print("ВАЖНО: При редактировании не меняйте размер холста и не выходите за красные рамки.")

def unstitch_images(stitched_image_path, meta_path):
    """
    Разрезает склеенное изображение на основе метаданных и перезаписывает оригинальные файлы.
    """
    if not os.path.exists(stitched_image_path):
        print(f"Файл изображения {stitched_image_path} не найден.")
        return
    if not os.path.exists(meta_path):
        print(f"Файл метаданных {meta_path} не найден.")
        return

    print(f"Чтение метаданных из {meta_path}...")
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta_json = json.load(f)
        
    # Поддержка версий метаданных
    if isinstance(meta_json, list):
        items = meta_json
        expected_size = None
        print("⚠ Старый формат метаданных. Проверка размеров отключена.")
    else:
        items = meta_json.get("items", [])
        expected_size = meta_json.get("canvas_size")

    print(f"Загрузка изображения {stitched_image_path}...")
    try:
        stitched = Image.open(stitched_image_path)
    except Exception as e:
        print(f"Ошибка открытия изображения: {e}")
        return

    # ПРОВЕРКА РАЗМЕРОВ
    if expected_size:
        w, h = stitched.size
        ew, eh = expected_size
        if w != ew or h != eh:
            print(f"\\n❌ КРИТИЧЕСКАЯ ОШИБКА РАЗМЕРА!")
            print(f"  Ожидалось: {ew}x{eh}")
            print(f"  Получено:  {w}x{h}")
            print("  Похоже, редактор обрезал холст или изменил его размер.")
            print("  Это приведет к смещению всех изображений (эффект «съехали»).")
            print("  !!! Скрипт попытается продолжить, но результат может быть некорректным.")
    
    if stitched.mode != 'RGBA':
        stitched = stitched.convert('RGBA')
    
    print("Начало разделения и перезаписи файлов...")
    success_count = 0
    
    for item in items:
        x, y, w, h = item['box']
        original_path = item['original_path']
        
        # Вырезаем область
        # box в crop: left, upper, right, lower
        crop = stitched.crop((x, y, x + w, y + h))
        
        # Пытаемся сохранить в оригинальный формат
        ext = os.path.splitext(original_path)[1].lower()
        if ext in ['.jpg', '.jpeg']:
            # Удаляем альфа-канал для JPEG
            bg = Image.new("RGB", crop.size, (255, 255, 255))
            bg.paste(crop, mask=crop.split()[3]) 
            save_img = bg
        else:
            save_img = crop
        
        try:
            # Создаем директории если вдруг они пропали
            os.makedirs(os.path.dirname(original_path), exist_ok=True)
            
            save_img.save(original_path)
            success_count += 1
        except Exception as e:
            print(f"Ошибка при сохранении {original_path}: {e}")
            
    print(f"Готово. Перезаписано {success_count} из {len(items)} файлов.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Скрипт для склейки и расклейки изображений.")
    subparsers = parser.add_subparsers(dest='command', help='Команды: stitch (склеить), unstitch (разделить)')
    
    # Команда stitch
    stitch_parser = subparsers.add_parser('stitch', help='Склеить изображения из папки')
    stitch_parser.add_argument('--dir', required=True, help="Путь к папке с исходными изображениями")
    stitch_parser.add_argument('--out', default='stitched_atlas.png', help="Имя выходного файла (по умолчанию stitched_atlas.png)")
    stitch_parser.add_argument('--meta', default='stitched_meta.json', help="Имя файла метаданных (по умолчанию stitched_meta.json)")
    
    # Команда unstitch
    unstitch_parser = subparsers.add_parser('unstitch', help='Разделить изображение обратно и перезаписать исходники')
    unstitch_parser.add_argument('--img', required=True, help="Путь к склеенному файлу")
    unstitch_parser.add_argument('--meta', required=True, help="Путь к файлу метаданных")
    
    args = parser.parse_args()
    
    if args.command == 'stitch':
        stitch_images(args.dir, args.out, args.meta)
    elif args.command == 'unstitch':
        unstitch_images(args.img, args.meta)
    else:
        parser.print_help()
