// Human-readable activity messages for browser DevTools Console.
// Never log passwords, bearer tokens, full request headers, or personal form values.
export const logLibraryActivity = (message, level = 'info') => {
  if (typeof console === 'undefined') return;
  const write = typeof console[level] === 'function' ? console[level] : console.info;
  write.call(console, `[Library] ${message}`);
};
