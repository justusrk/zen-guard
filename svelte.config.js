import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  onwarn: (warning, handler) => {
    // Suppress state_referenced_locally warnings - we intentionally capture initial values
    if (warning.code === 'state_referenced_locally') return
    handler(warning)
  }
}
