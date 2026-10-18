/** Quote all cells and neutralize spreadsheet formula prefixes on export. */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return (
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
