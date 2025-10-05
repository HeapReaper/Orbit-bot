export function formatDate(date: Date | string): string {
  let dateObj: Date;

  if (typeof date === "string") {
    const [year, month, day] = date.split("-").map(Number);
    dateObj = new Date(Date.UTC(year, month - 1, day));
  } else {
    dateObj = date;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formatted = formatter.format(dateObj);

  return formatted.replace(/\//g, "-");
}

export function formatIsoDate(input: string) {
  const date = new Date(input);

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatTimestamp(timestamp: number | null): string | null {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${hours}:${minutes} ${day}-${month}-${year}`;
}