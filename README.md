# Codex Startup Animation · Windows 11

[中文](#中文) · [Tiếng Việt](#tiếng-việt)

---

## 中文

给 Windows 11 上的官方 Codex / ChatGPT 桌面应用加上一段可自定义的启动动画，以及动画结束后的静态透明背景。

这是个人开发的**非官方外部启动器**。它启动本机已经安装的官方应用，在主窗口临时加入动画；不修改官方安装包或 `app.asar`，不替换聊天、模型或工具功能。

### 效果

默认「寻光」约 12 秒。前半段（头像）和后半段（线稿显影）可分开选：原版、寻光、涟漪、雾散。头像、背景、标题、字幕和强调色都可以换。Esc 可跳过。

### 功能

- 两张自定义图片：前半段头像、后半段背景；换背景时自动生成轮廓。
- 可编辑开场标题、小字和后半段字幕，文字留空可隐藏。
- 背景透明程度可调；动画时长 6–20 秒（时间轴仍按 12 秒编排）。
- 点击跳过或按 Esc 可跳过动画。
- 接入失败时回退为普通官方启动。
- 若官方应用已经在运行，只会激活现有窗口，不会重播动画。

设置快捷键：**Ctrl+Alt+B**。

### 环境要求

- Windows 11
- 已安装官方 Codex / ChatGPT 桌面应用（Microsoft Store 包 `OpenAI.Codex` 或常见解包安装）
- Node.js 22+，或官方应用附带的 `cua_node`
- 独立预览需要 Microsoft Edge
- 编译 `.exe` 需要系统自带的 `csc.exe`（.NET Framework 4.x）

曾在官方 Store 包 **26.1002.7124.0**（`app\ChatGPT.exe`）上验证。新版本可能改变调试开关、窗口地址或主题变量，不保证自动兼容。

### 构建与使用

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-windows.ps1
```

| 文件 | 用途 |
| --- | --- |
| `dist\windows\CodexStartup.exe` | 启动 Codex 并播放动画（无控制台窗口） |
| `dist\windows\Codex Startup.lnk` | 开始菜单 / 任务栏请固定这个快捷方式 |
| `dist\windows\AemeathPreview.exe` | 独立动画预览 |
| `扩展启动Codex.vbs` | 无窗口启动；`.cmd` 只是转给它 |

不编译也可以：

```powershell
node windows\run.mjs
node windows\preview.mjs
```

使用步骤：

1. 运行一次 `tools\build-windows.ps1`，开始菜单会出现 **Codex Startup**。把它固定到任务栏，不要固定已经打开的 Codex 窗口。
2. 之后点任务栏上的 **Codex Startup**（或双击 `扩展启动Codex.vbs`）。若 Codex 已在运行，启动器会先退出再带动画打开。
3. 官方页面与动画并行加载；动画结束后进入正常页面。
4. 只检查动画时，运行 `预览动画.vbs` 或用浏览器打开 `index.html`。

任务栏上的官方 Codex / ChatGPT 图标走的是原版入口，不会播放本动画。

### 图片与文字设置

动画中或结束后按 **Ctrl+Alt+B**。

| 设置 | 说明 |
| --- | --- |
| 头像 | PNG / JPEG / WebP，导入时居中裁成 512×512 |
| 背景 | PNG / JPEG / WebP / GIF / APNG；静态图居中裁成 1536×1024。GIF、动态 WebP、APNG 保留动画，线稿取首帧 |
| 标题与字幕 | 修改两段动画的文字，留空则隐藏 |
| 背景显现程度 | 默认 42%，0% 关闭壁纸 |
| 开场动画时长 | 默认 12 秒；6–20 秒可调 |
| 前半段出现 | 原版 / 寻光 / 涟漪 / 雾散（头像与脉冲） |
| 后半段出现 | 原版 / 寻光 / 涟漪 / 雾散（线稿与显影） |
| 画面色彩 | 当前粉 / 冷白 / 琥珀，或自定义一个强调色；只改线稿和 HUD，不改照片 |
| 界面语言 | 中文或 Tiếng Việt；保存在本机 |
| 保存并预览 | 保存后重播 |
| Esc / × | 放弃未保存修改 |

单张图片不超过 30 MB。图片和文字保存在本机 IndexedDB，不上传。

### 安装检测

启动器不假设固定路径，按以下顺序查找：

1. Microsoft Store / MSIX 包 `OpenAI.Codex_*`
2. 卸载注册表中发布者为 OpenAI 的 Codex / ChatGPT
3. `%LOCALAPPDATA%\Programs\ChatGPT\`、`Codex\` 等常见解包位置

### 调试端口与安全

扩展接入会附加：

```text
--remote-debugging-address=127.0.0.1
--remote-debugging-port=<随机端口>
```

端口只绑定 `127.0.0.1`。连接前校验监听地址、进程路径和当前用户。不要把该端口映射到局域网。

**调试端口会随官方应用进程保留。** 完全退出后再从官方图标打开，才会结束本次调试状态。

### 卸载

1. 完全退出官方 Codex / ChatGPT。
2. 删除本仓库（以及 `dist\windows\`）。
3. 可选：删除 `%LOCALAPPDATA%\AemeathStartup\`。

自定义设置在 IndexedDB（`aemeath-startup-images`）中；可在设置里恢复默认。从官方图标启动后不会再加载覆盖层。本项目不写入官方安装目录。

### 测试

```powershell
node --test tools\extension.test.mjs tools\windows.test.mjs
node windows\preview.mjs --smoke-test --duration 4000
node windows\run.mjs --probe
```

### 故障排除

| 现象 | 处理 |
| --- | --- |
| 只有官方窗口、没有动画 | 先完全退出 Codex（含托盘）再从本入口启动 |
| 未找到应用 | 确认已安装 Store 版 ChatGPT / Codex |
| 尚未找到主窗口 | 该版本可能未接受调试开关；从官方图标打开仍可正常使用 |
| 预览打不开 | 需要 Edge，或直接打开 `index.html` |
| 编译失败 | 用 `node windows\run.mjs` 即可启动 |

### 已知限制

- 为传入 Chromium 调试开关，启动器直接运行 `ChatGPT.exe`，官方日志可能出现 `The process has no package identity`。
- 整页刷新、新窗口、应用更新后重启，可能不会保留美化。
- 壁纸 CSS 随官方主题 token 变化，新版本可能需要适配。
- 启动器使用系统默认图标。

本项目与 OpenAI 无隶属关系。角色图片及花形图标的权利归相应权利人。当前未指定开源许可证。

---

## Tiếng Việt

Thêm đoạn animation khởi động tùy chỉnh cho ứng dụng desktop Codex / ChatGPT chính thức trên Windows 11, rồi giữ hình nền tĩnh trong suốt sau khi animation kết thúc.

Đây là **launcher ngoài, không chính thức**. Nó mở app OpenAI đã cài trên máy, gắn animation tạm vào cửa sổ chính; không sửa gói cài, không đụng `app.asar`, không thay chat / model / tool.

### Hiệu ứng

Mặc định「寻光」khoảng 12 giây. Nửa đầu (avatar) và nửa sau (nét, hiện ảnh) chọn riêng: gốc, 寻光, gợn sóng, sương tan. Đổi được avatar, nền, chữ và màu nhấn. Esc bỏ qua.

### Tính năng

- Hai ảnh: avatar nửa đầu, nền nửa sau; đổi nền thì tự vẽ line-art.
- Sửa tiêu đề, chữ nhỏ, phụ đề; để trống thì ẩn.
- Chỉnh độ hiện nền; thời lượng 6–20 giây (timeline gốc vẫn 12s).
- Esc hoặc nút skip để bỏ qua.
- Inject lỗi thì mở Codex bình thường.
- App đang chạy thì launcher thoát hẳn rồi mở lại kèm animation.

Phím cài đặt: **Ctrl+Alt+B**.

### Yêu cầu

- Windows 11
- Đã cài Codex / ChatGPT Desktop (Microsoft Store `OpenAI.Codex` hoặc bản giải nén thông thường)
- Node.js 22+, hoặc `cua_node` kèm theo app chính thức
- Preview độc lập cần Microsoft Edge
- Ra file `.exe` cần `csc.exe` (.NET Framework 4.x có sẵn trên Windows)

Đã kiểm trên gói Store **26.1002.7124.0** (`app\ChatGPT.exe`). Bản mới có thể đổi cờ debug, địa chỉ cửa sổ hoặc biến giao diện.

### Cài và dùng

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-windows.ps1
```

| File | Việc dùng |
| --- | --- |
| `dist\windows\CodexStartup.exe` | Mở Codex kèm animation (không cửa sổ console) |
| `dist\windows\Codex Startup.lnk` | Ghim shortcut này lên taskbar |
| `dist\windows\AemeathPreview.exe` | Xem animation không cần Codex |
| `扩展启动Codex.vbs` | Chạy ẩn; `.cmd` chỉ chuyển sang VBS |

Không build cũng được:

```powershell
node windows\run.mjs
node windows\preview.mjs
```

Các bước:

1. Chạy `tools\build-windows.ps1` một lần. Start Menu có **Codex Startup** — ghim cái đó, đừng ghim cửa sổ Codex đang mở.
2. Lần sau bấm **Codex Startup** trên taskbar (hoặc `扩展启动Codex.vbs`). Nếu Codex đang chạy, launcher thoát rồi mở lại kèm animation.
3. Animation chạy song song trang chính thức, xong thì vào giao diện thật.
4. Chỉ xem animation: `预览动画.vbs` hoặc mở `index.html`.

Icon Codex / ChatGPT chính thức trên taskbar không phát animation của repo này.

### Ảnh và chữ

Trong hoặc sau animation, bấm **Ctrl+Alt+B**.

| Mục | Ý nghĩa |
| --- | --- |
| Avatar | PNG / JPEG / WebP, cắt giữa 512×512 |
| Nền | PNG / JPEG / WebP / GIF / APNG. Ảnh tĩnh cắt 1536×1024. GIF, WebP động, APNG giữ animation; nét lấy khung đầu |
| Tiêu đề / phụ đề | Để trống thì ẩn |
| Độ hiện nền | Mặc định 42%, 0% là tắt wallpaper |
| Thời lượng | Mặc định 12 giây, chỉnh 6–20 giây |
| Nửa đầu | Gốc / 寻光 / gợn sóng / sương tan (avatar) |
| Nửa sau | Gốc / 寻光 / gợn sóng / sương tan (nét và hiện ảnh) |
| Màu overlay | Hồng hiện tại / trắng lạnh / hổ phách, hoặc một màu tự chọn; chỉ nhuộm nét và HUD |
| Ngôn ngữ giao diện | Tiếng Trung hoặc Tiếng Việt; lưu trên máy |
| Lưu và xem lại | Lưu rồi phát lại |
| Esc / × | Hủy thay đổi chưa lưu |

Mỗi ảnh tối đa 30 MB. Lưu trên máy (IndexedDB), không upload.

### Tìm app

Launcher không gắn path cứng:

1. Gói Microsoft Store / MSIX `OpenAI.Codex_*`
2. Registry gỡ cài, publisher OpenAI
3. `%LOCALAPPDATA%\Programs\ChatGPT\`, `Codex\`, …

### Cổng debug và an toàn

Khi gắn animation, app được mở với:

```text
--remote-debugging-address=127.0.0.1
--remote-debugging-port=<cổng ngẫu nhiên>
```

Chỉ bind `127.0.0.1`. Trước khi nối sẽ kiểm tra địa chỉ, đường dẫn process và user hiện tại. Đừng map cổng này ra LAN.

**Cổng debug sống theo process Codex.** Thoát hẳn rồi mở lại từ icon gốc thì cổng đóng.

### Gỡ

1. Thoát hẳn Codex / ChatGPT.
2. Xóa thư mục repo (và `dist\windows\` nếu có).
3. Tùy chọn: xóa `%LOCALAPPDATA%\AemeathStartup\`.

Ảnh chữ tùy chỉnh nằm trong IndexedDB (`aemeath-startup-images`); vào cài đặt chọn khôi phục mặc định nếu muốn xóa. Mở từ icon gốc sẽ không còn overlay. Repo không ghi vào thư mục cài OpenAI.

### Kiểm thử

```powershell
node --test tools\extension.test.mjs tools\windows.test.mjs
node windows\preview.mjs --smoke-test --duration 4000
node windows\run.mjs --probe
```

### Khi gặp lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Chỉ thấy Codex, không có animation | Thoát hẳn (cả khay) rồi mở từ launcher này |
| Không tìm thấy app | Cài ChatGPT / Codex từ Microsoft Store |
| Không thấy cửa sổ chính | Bản đó có thể bỏ cờ debug; mở icon gốc vẫn dùng được |
| Preview không mở | Cần Edge, hoặc mở `index.html` |
| Build `.exe` lỗi | Chạy `node windows\run.mjs` |

### Giới hạn

- Để đưa cờ Chromium debug, launcher chạy thẳng `ChatGPT.exe`; log chính thức có thể ghi `The process has no package identity`.
- Refresh cả trang, cửa sổ mới, hoặc app tự restart sau update có thể mất lớp trang trí.
- CSS wallpaper phụ thuộc token giao diện chính thức, bản mới có thể phải chỉnh.
- Icon launcher là icon mặc định của hệ thống.

Dự án không liên thuộc OpenAI. Quyền đối với ảnh nhân vật và logo hoa thuộc về chủ sở hữu tương ứng. Hiện chưa gắn giấy phép mã nguồn.
