import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode,process.cwd(),"");
  const target = env["PLUGG_BACKEND_URL"] || "http://127.0.0.1:3000";
  const proxy = Object.fromEntries(["/api/admin/v1", "/api/stream/", "/api/file/"].map(path => [path,{ target, changeOrigin:true }]));
  return { plugins:[react(),tailwindcss()], resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}}, server:{proxy},preview:{proxy} };
});
