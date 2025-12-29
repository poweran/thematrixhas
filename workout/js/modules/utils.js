import { ALPHABET } from './constants.js';

export function getWeekDays(count, offset = 0) {
    const now = new Date();
    // Get Monday of current week
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1) + (offset * 7); // Apply offset here
    const monday = new Date(d.setDate(diff));

    const offsets = [];
    if (count === 1) offsets.push(0);
    else if (count === 2) offsets.push(0, 3); // Mon, Thu
    else if (count === 3) offsets.push(0, 2, 4); // Mon, Wed, Fri
    else if (count === 4) offsets.push(0, 1, 3, 4);
    else {
        for (let i = 0; i < count; i++) offsets.push(i);
    }

    return offsets.map(o => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + o);
        return date;
    });
}

export function getWeekMonday(offset) {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1) + (offset * 7);
    return new Date(d.setDate(diff));
}

export function getWeekId(offset = 0) {
    const targetMonday = getWeekMonday(offset);
    const y = targetMonday.getFullYear();
    const m = (targetMonday.getMonth() + 1).toString().padStart(2, '0');
    const dd = targetMonday.getDate().toString().padStart(2, '0');

    return `${y}-${m}-${dd}`;
}

export function isDateInRange(date, start, end) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return d >= s && d <= e;
}

export function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function keyOf(m, t, s) {
    return `${m}_${t}_${s}`;
}

export function formatTime(t) {
    const m = Math.floor(Math.abs(t) / 60).toString().padStart(2, '0');
    const s = (Math.abs(t) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function getTrainings(days) {
    return ALPHABET.slice(0, days).split('');
}

export function getSets(setsCount) {
    return Array.from({ length: setsCount }, (_, i) => i + 1);
}
