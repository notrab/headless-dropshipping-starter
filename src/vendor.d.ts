// Ambient declarations for third-party modules. Keep this file free of
// imports/exports so these stay global.

// Splide's stylesheets are exported without a .css extension, so TypeScript
// can't tell they're CSS; Vite handles them
declare module "@splidejs/splide/css/*";
