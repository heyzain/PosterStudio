export const keyDate = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');

export function localDateTime(date = new Date()) {
  return keyDate(date) + 'T' + date.toTimeString().slice(0,5);
}
