<div align="center">

<img src="resources/icon.png" width="80" alt="CopyDash" />

# CopyDash

A Windows clipboard manager.

[![Platform](https://img.shields.io/badge/platform-Windows-blue?logo=windows)](https://github.com/hanyiwei/copydash)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-orange)](https://github.com/hanyiwei/copydash/releases)

*[中文版本](#中文版本)*

</div>

## Download

Download the latest version from [Releases](https://github.com/hanyiwei/copydash/releases):

- **`CopyDash-Setup-x.x.x.exe`** — NSIS installer, choose your install directory.

## Features

- **Clipboard monitoring** — automatically captures text, images, files, colors, and links as you copy
- **Global shortcut** — press `Alt+Shift+V` to toggle the panel from anywhere
- **Type filters** — filter by Text, Image, Link, Color, or File
- **Full-text search** — search across all clipboard history instantly
- **Pin items** — keep frequently used clips at hand
- **Quick paste** — double-click a card to paste, or `Shift+Click` to paste as plain text
- **Right-click menu** — Copy, Paste, Paste as Plain Text, Pin/Unpin, Delete
- **Color detection** — auto-detects HEX, RGB, and HSL colors with a live preview swatch
- **Syntax highlighting** — code and markup rendered with highlight.js
- **Privacy mode** — exclude specific apps (1Password, Bitwarden, KeePass, Remote Desktop, etc.) from clipboard recording
- **Light / Dark theme** — warm beige light mode inspired by Anthropic's design, plus a dark mode
- **Auto-update** — checks for new GitHub releases on startup and installs with one click
- **Bilingual UI** — English and Chinese language support
- **System tray** — runs quietly in the system tray
- **Configurable history** — set max history to 100, 200, or 300 items
- **Auto-launch** — optionally start with Windows
- **Transparent panel** — always-on-top frameless window with smooth enter/exit animations

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+V` | Toggle CopyDash panel |
| `Double-click` | Paste selected item |
| `Shift+Click` | Paste as plain text |
| `Right-click` | Context menu |
| `Esc` | Clear all filters |
| `Mouse wheel` | Scroll cards horizontally |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 30 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Database | SQLite (sql.js) |
| Highlighting | highlight.js |
| Image processing | Jimp |
| Icons | Lucide React |
| Build | electron-vite |
| Auto-update | electron-updater |



## License

MIT

---

<h2 id="中文版本">中文版本</h2>

## 下载

从 [Releases](https://github.com/hanyiwei/copydash/releases) 下载最新版本：

- **`CopyDash-Setup-x.x.x.exe`** — NSIS 安装包，可自定义安装路径


## 功能

- **剪贴板监听** — 自动捕获文本、图片、文件、颜色和链接
- **全局快捷键** — 按下 `Alt+Shift+V` 随时随地呼出面板
- **类型筛选** — 按文本、图片、链接、颜色、文件分类筛选
- **全文搜索** — 即时搜索所有剪贴板历史
- **钉选** — 常用记录一键钉住，方便查找
- **快速粘贴** — 双击卡片粘贴，`Shift+点击` 粘贴为纯文本
- **右键菜单** — 粘贴、粘贴为纯文本、钉选/取消钉选、删除
- **颜色识别** — 自动识别 HEX、RGB、HSL 颜色并显示预览色块
- **语法高亮** — 使用 highlight.js 渲染代码片段
- **隐私模式** — 排除特定应用（1Password、Bitwarden、KeePass、远程桌面等）的剪贴板记录
- **明暗主题** — 暖米色浅色模式 + 深色模式
- **自动更新** — 启动时自动检查 GitHub 新版本，一键安装
- **双语界面** — 支持中英文切换
- **系统托盘** — 安静运行在系统托盘中
- **历史记录上限** — 可设置 100 / 200 / 300 条上限
- **开机自启** — 可选开机自动启动
- **透明面板** — 无边框置顶窗口，平滑进出动画

## 快捷键

| 快捷键 | 操作 |
|----------|------|
| `Alt+Shift+V` | 呼出/隐藏面板 |
| `双击` | 粘贴选中项 |
| `Shift+点击` | 粘贴为纯文本 |
| `右键` | 上下文菜单 |
| `Esc` | 清除所有筛选 |
| `鼠标滚轮` | 横向滚动卡片 |

## 技术栈

| 层 | 技术 |
|-------|-----------|
| 壳 | Electron 30 |
| UI | React 18 + TypeScript |
| 样式 | Tailwind CSS 3 |
| 状态管理 | Zustand |
| 数据库 | SQLite (sql.js) |
| 语法高亮 | highlight.js |
| 图片处理 | Jimp |
| 图标 | Lucide React |
| 构建 | electron-vite |
| 自动更新 | electron-updater |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 打包分发
npm run dist
```

## 项目结构

```
src/
├── main/            # Electron 主进程
│   ├── index.ts     # 窗口管理、IPC、托盘、全局快捷键
│   ├── monitor.ts   # 剪贴板轮询、格式检测、内容哈希
│   ├── updater.ts   # GitHub releases 自动更新
│   └── db/          # SQLite 数据库层
├── preload/         # Context bridge (contextBridge)
└── renderer/        # React UI
    ├── App.tsx      # 根布局
    ├── components/  # ClipItem, ClipList, SearchBar, SettingsPanel
    ├── store/       # Zustand 状态管理
    ├── utils/       # 语法高亮、URL 检测、类型匹配
    └── styles/      # Tailwind + 自定义样式
```

## 许可证

MIT

---
Built by [大花](https://github.com/hanyiwei) with Claude Code.
