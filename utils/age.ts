export function calcAge(birthDate: Date): number {
  const today = new Date();
  let age: number = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

export function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}