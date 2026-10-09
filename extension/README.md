# 外部扩展 / Phần mở rộng bên ngoài

中文：临时 iframe、本机 CDP、静态壁纸。不修改官方包，不安装守护进程。

Tiếng Việt: iframe tạm, CDP máy local, hình nền tĩnh. Không sửa gói chính thức, không cài process nền.

- `renderer.mjs`：临时 iframe、可信闭包通信、静态壁纸、快捷键与完全恢复。不注册永久轮询。
- `payload.mjs`：打包本地 HTML/CSS/图片/动画函数，绑定 iframe 环境。
- `cdp.mjs`：主窗口筛选、回环 WebSocket 验证、超时和连接清理。
- `windows/run.mjs`：Windows 启动入口；校验安装与 `127.0.0.1` 调试端口，确认播放后退出。
- `wallpaper.css`：按官方布局 token 设置透明表面。

设置快捷键：Windows 为 **Ctrl+Alt+B**。CDP 端口随 Codex 进程保留；完全退出后再从官方图标打开才会关闭。
