// A simple obfuscation utility to prevent plaintext storage of session data
// Note: In a real-world scenario with highly sensitive data, consider using Web Crypto API.
// For session restoration UX, this basic obfuscation is sufficient to hide it from casual inspection.

export const obfuscate = (data: string): string => {
  try {
    const encoded = encodeURIComponent(data);
    let result = "";
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(encoded.charCodeAt(i) + 13); // Simple shift
    }
    return btoa(result);
  } catch (e) {
    return "";
  }
};

export const deobfuscate = (obfuscated: string): string => {
  try {
    const decoded = atob(obfuscated);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) - 13);
    }
    return decodeURIComponent(result);
  } catch (e) {
    return "";
  }
};
