export const round = (n: number) => Math.round(n * 10) / 10;
export const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;
