import { defineConfig } from 'vite'

export default defineConfig(async () => {
  const tailwindcss = await import('@tailwindcss/vite').then(m => m.default)
  
  return {
    plugins: [
      tailwindcss(),
    ],
  }
})
