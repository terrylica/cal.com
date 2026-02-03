import { addWeeks, isAfter, isValid, parseISO, startOfMonth } from "date-fns";

export const isMonthViewPrefetchEnabled = (date: string, month: string | null) => {
  const parsedDate = parseISO(date);
  const isValidDate = isValid(parsedDate);

  if (!month) {
    return false;
  }

  const monthDate = parseISO(month.length === 7 ? month + "-01" : month);
  const twoWeeksAfter = addWeeks(startOfMonth(monthDate), 2);
  const now = new Date();
  const isSameMonth =
    now.getFullYear() === monthDate.getFullYear() && now.getMonth() === monthDate.getMonth();
  const isAfter2Weeks = isAfter(now, twoWeeksAfter);

  if (isAfter2Weeks && (!isValidDate || isSameMonth)) {
    return true;
  }

  return false;
};
