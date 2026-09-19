import { defineConfig } from 'vite';

// base './' usa caminhos relativos — funciona em qualquer subpath do GitHub Pages
// (ex.: https://usuario.github.io/nome-do-repo/) sem precisar reconfigurar.
// outDir (dist) e assetsDir (assets) já são os padrões do Vite.
export default defineConfig({
  base: './',
});