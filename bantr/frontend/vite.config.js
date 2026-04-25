import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var backendOrigin = (_b = env.VITE_BACKEND_ORIGIN) !== null && _b !== void 0 ? _b : "http://localhost:8003";
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target: backendOrigin,
                    changeOrigin: true,
                },
                "/health": {
                    target: backendOrigin,
                    changeOrigin: true,
                },
            },
        },
    };
});
