# 参考与素材说明 / Tài liệu tham khảo và chất liệu

## 中文

以下项目用于研究实现方式。本项目未复制其源代码，也不需要安装或运行它们。

| 参考项目 | 参考范围 |
| --- | --- |
| [Tangc/codex-skin-launcher](https://github.com/Tangc/codex-skin-launcher) | 原生窗口、应用标识与独立启动入口 |
| [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) | 整窗壁纸、透明表面、本机 CDP 接入及目标进程校验 |
| [NativeDog1/dsh-boot-animation](https://github.com/NativeDog1/dsh-boot-animation) | 可跳过的覆盖式片头、完成后移除、素材就绪后播放和超时兜底 |

本仓库是 [codex-startup-animation](https://github.com/imxyanua/codex-startup-animation) 的 **Windows 11** 专用版本。动画与外部接入独立实现，不修改官方 Codex 安装包。

默认头像和背景来自项目所有者提供的本地图片。自定义背景在导入时由本机 Canvas 生成轮廓。动画由 HTML、CSS、Canvas 和 SVG 绘制，无音轨、远程字体、CDN 或在线图片请求。

## Tiếng Việt

Các dự án trên chỉ dùng để tham khảo cách làm. Repo này không sao chép mã nguồn của chúng.

Đây là bản **Windows 11** tách từ [codex-startup-animation](https://github.com/imxyanua/codex-startup-animation). Animation và phần gắn vào Codex viết riêng, không sửa gói cài chính thức.

Ảnh mặc định do chủ repo cung cấp. Nền tùy chỉnh được vẽ nét bằng Canvas trên máy. Animation vẽ bằng HTML/CSS/Canvas/SVG, không nhạc, không font/CDN/ảnh online.
