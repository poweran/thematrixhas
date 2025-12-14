export const EMOTIONAL_WORDS = [
    "Эйфория", "Хаос", "На грани", "Пульс", "Взрыв",
    "Дыши", "Свет", "Тьма", "Ритм", "Огонь",
    "Бесконечность", "Забытье", "Крик", "Тишина",
    "Скорость", "Полет", "Падение", "Дрожь",
    "Экстаз", "Гроза", "Буря", "Шторм",
    "Вспышка", "Мираж", "Ток", "Сигнал"
];

export function getRandomWord() {
    return EMOTIONAL_WORDS[Math.floor(Math.random() * EMOTIONAL_WORDS.length)];
}
