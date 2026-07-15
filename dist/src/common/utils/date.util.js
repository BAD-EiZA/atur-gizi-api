"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localDateString = localDateString;
exports.parseDateOnly = parseDateOnly;
exports.ageFromDob = ageFromDob;
exports.roundToNearest10 = roundToNearest10;
function localDateString(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}
function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error('invalid_date');
    }
    return new Date(`${value}T00:00:00.000Z`);
}
function ageFromDob(dob, now = new Date()) {
    const y = now.getUTCFullYear() - dob.getUTCFullYear();
    const m = now.getUTCMonth() - dob.getUTCMonth();
    const d = now.getUTCDate() - dob.getUTCDate();
    if (m < 0 || (m === 0 && d < 0))
        return y - 1;
    return y;
}
function roundToNearest10(n) {
    return Math.round(n / 10) * 10;
}
//# sourceMappingURL=date.util.js.map