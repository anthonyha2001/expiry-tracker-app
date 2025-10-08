import { differenceInDays, parseISO, isPast } from 'date-fns';

export const getExpiryStatus = (dateString) => {
  const date = parseISO(dateString);
  if (isNaN(date)) {
    return 'ok';
  }
  if (isPast(date)) {
    return 'expired';
  }
  const daysUntilExpiry = differenceInDays(date, new Date());
  if (daysUntilExpiry <= 30) {
    return 'near-expiry';
  }
  return 'ok';
};
