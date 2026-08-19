import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateForInput(date: any): string {
  if (!date) return '';
  
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    // Check if it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'object' && date.seconds !== undefined) {
    // Handle plain objects that look like Timestamps (sometimes happens with JSON serialization)
    d = new Date(date.seconds * 1000);
  } else {
    return '';
  }

  if (isNaN(d.getTime())) return '';
  
  // Adjust for timezone to get UTC date correctly if it's a date-only string
  // or just use toISOString if it's a full timestamp
  return d.toISOString().split('T')[0];
}

export function sanitizeUrl(url: string): string {
  if (!url) return '';
  let sanitized = url.trim();
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    sanitized = `https://${sanitized}`;
  }
  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    return url; // Return original if it's still not a valid URL structure
  }
}

export function getHostname(url: string): string {
  if (!url) return '';
  try {
    let sanitized = url.trim();
    if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
      sanitized = `https://${sanitized}`;
    }
    return new URL(sanitized).hostname;
  } catch {
    return '';
  }
}

export function generateJournalAbbreviation(title: string): string {
  if (!title) return '';
  const stopWords = ['of', 'and', 'the', 'in', 'on', 'at', 'for', 'to', 'with', 'by', 'as'];
  return title
    .split(/\s+/)
    .filter(word => word && !stopWords.includes(word.toLowerCase()))
    .map(word => {
       if (word.length <= 4) return word;
       return word.substring(0, 3) + '.';
    })
    .join(' ');
}

export function generateJournalInitials(title: string): string {
  if (!title) return '';
  const stopWords = ['of', 'and', 'the', 'in', 'on', 'at', 'for', 'to', 'with', 'by', 'as'];
  return title
    .split(/\s+/)
    .filter(word => word && !stopWords.includes(word.toLowerCase()))
    .map(word => word[0].toUpperCase())
    .join('');
}
