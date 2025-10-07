export function getCurrentDate() {
  const now = new Date();
   return  now.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getCurrentTime() {
  const now = new Date();
  return  now.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Amsterdam",
  });
}