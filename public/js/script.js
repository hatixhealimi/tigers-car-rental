// Compatibility loader for the original static pages.
// It lets the site work when opened directly from WebStorm as file:///.
(() => {
  if (window.Tigers || document.querySelector('script[src$="/js/main.js"], script[src="js/main.js"]')) return;
  const script = document.createElement("script");
  script.src = new URL("main.js", document.currentScript.src).href;
  document.head.append(script);
})();
