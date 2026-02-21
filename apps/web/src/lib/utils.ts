import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytesString(bytesStr: string): string {
  const bytes = BigInt(bytesStr);
  if (bytes === 0n) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  // bitLength() is roughly log2(n). log2(n) / 10 gives the 1024-based index.
  let i = Math.floor(bytes.toString(2).length / 10);
  if (i >= sizes.length) i = sizes.length - 1;

  // 1024 ** i using bit shifting for performance (1n << BigInt(i * 10))
  const divisor = 1n << BigInt(i * 10);

  // Convert to Number only at the end for formatting
  const value = Number(bytes) / Number(divisor);

  return `${value.toFixed(2)} ${sizes[i]}`;
}

export function formatDate(
  dateString: string | Date,
  includeTime: boolean = false
): string {
  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return date.toLocaleDateString("en-US", options);
}