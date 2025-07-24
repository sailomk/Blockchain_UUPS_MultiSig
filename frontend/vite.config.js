import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // เพิ่ม alias จำเป็นสำหรับ ethers และ hardhat
      //'ethers': 'ethers/dist/ethers.min.js',
      '../../artifacts': '../artifacts'
    }
  },
})
