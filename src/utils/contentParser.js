export function containsWholeWord(text, word) {
  let regex = new RegExp(`\\b${word}\\b`, 'i'); // \b ensures word boundaries, 'i' makes it case-insensitive
  return regex.test(text);
}

export function parseRecordingDate(dateStr) {
  if (!dateStr) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = dateStr.split("-").map(Number);
  
  // Get the month abbreviation
  const monthAbbr = months[month - 1];

  // Function to get ordinal suffix (st, nd, rd, th)
  const getOrdinal = (num) => {
      if (num >= 11 && num <= 13) return "th";
      const lastDigit = num % 10;
      return lastDigit === 1 ? "st" :
             lastDigit === 2 ? "nd" :
             lastDigit === 3 ? "rd" : "th";
  };

  return `${monthAbbr} ${day}${getOrdinal(day)}`;
}

