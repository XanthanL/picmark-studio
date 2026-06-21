# 图印工坊 移动端部署指南

## 项目概述

本项目为纯前端 H5 应用，无需后端服务器、数据库或复杂运行时环境。核心功能依赖浏览器原生 API（Canvas、FileReader、FontFace）和前端库（JSZip、FileSaver）。

项目结构：

```
mobile-h5/
├── index.html          # 入口页面
├── css/style.css       # 样式文件
├── js/app.js           # 业务逻辑
└── lib/                # 第三方库（JSZip、FileSaver）
```

## 1. 部署前准备工作

### 1.1 环境检查

- 确认项目文件完整，至少包含 `index.html`、`css/style.css`、`js/app.js`、`lib/jszip.min.js`、`lib/FileSaver.min.js`
- 确认无外部 CDN 依赖（所有库已本地包含）
- 准备一台可联网的电脑用于上传

### 1.2 本地预览验证

在项目根目录执行：

```bash
python -m http.server 8080
```

然后在电脑浏览器访问 `http://localhost:8080/`，验证以下功能：

1. 页面能正常加载，无样式错乱
2. 能上传底图并显示预览
3. 点击图片能定位/取色
4. 能输入名单并生成 ZIP 下载
5. 在不同浏览器宽度下（手机模拟器）布局正常

### 1.3 兼容性预检

- **浏览器**：Chrome / Safari / Edge / 微信内置浏览器 / QQ 浏览器
- **系统**：Android 8+ / iOS 13+
- **必要 API**：File API、Canvas、ES6（`async/await`、`const/let`）

> 注：iOS 13 以下系统可能不支持 `FontFace` API，但核心生成功能不受影响。

## 2. 部署方案选择

### 方案对比

| 方案 | 优点 | 缺点 | 适合场景 |
|------|------|------|----------|
| GitHub Pages | 免费、稳定、可绑定自定义域名 | 国内访问可能较慢 | 海外用户或技术爱好者 |
| Vercel / Netlify | 免费、自动 HTTPS、全球 CDN | 国内访问一般 | 个人/小团队 |
| 腾讯云 COS | 国内访问快、成本低、支持 HTTPS | 需要配置 bucket 和域名 | 国内用户为主 |
| 阿里云 OSS | 国内访问快、生态完善 | 需要配置 bucket 和域名 | 国内用户为主 |
| 云服务器 + Nginx | 完全自主、可扩展 | 需要服务器和运维 | 有服务器资源的用户 |

### 推荐方案

- **国内用户为主**：腾讯云 COS 或阿里云 OSS
- **海外用户或免费优先**：Vercel 或 GitHub Pages
- **已有服务器**：Nginx 静态部署

## 3. 完整部署步骤

### 方案 A：Vercel 部署（推荐，免费且简单）

1. 注册 [Vercel](https://vercel.com) 账号（可用 GitHub 账号登录）
2. 将 `mobile-h5` 文件夹上传到 GitHub 仓库
3. 在 Vercel 控制台点击 "Add New Project"
4. 选择刚才创建的 GitHub 仓库
5. Framework Preset 选择 "Other"
6. Build Command 留空，Output Directory 留空
7. 点击 Deploy
8. 部署完成后，Vercel 会提供一个 `xxx.vercel.app` 域名
9. （可选）在 Vercel 设置中绑定自己的域名，并配置 DNS

### 方案 B：腾讯云 COS 部署（国内访问快）

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入对象存储 COS，创建存储桶（Bucket）
3. 地域选择距离用户最近的节点（如华东-上海）
4. 访问权限选择 **公有读私有写**
5. 创建完成后，进入存储桶 → 文件列表
6. 上传 `mobile-h5` 目录下的所有文件（保持目录结构）
7. 进入存储桶 → 基础配置 → 静态网站
8. 开启静态网站，索引文档填写 `index.html`，错误文档可填 `index.html`
9. 获取静态网站访问地址，即可在浏览器中打开
10. （可选）绑定自定义域名：在存储桶 → 域名与传输管理 → 自定义源站域名 中配置
11. （可选）申请免费 SSL 证书：腾讯云 SSL 证书管理可申请，然后在 CDN 或自定义域名中开启 HTTPS

### 方案 C：云服务器 + Nginx 部署

#### 3.3.1 服务器准备

- 购买一台 Linux 云服务器（如腾讯云 CVM、阿里云 ECS）
- 推荐系统：Ubuntu 22.04 LTS
- 开放 80 和 443 端口

#### 3.3.2 上传项目文件

使用 SCP 或 SFTP 工具（如 FileZilla、WinSCP）将 `mobile-h5` 目录上传到服务器：

```bash
scp -r mobile-h5/ root@your-server-ip:/var/www/
```

#### 3.3.3 安装 Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

#### 3.3.4 配置 Nginx

创建站点配置文件：

```bash
sudo nano /etc/nginx/sites-available/picmark
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/mobile-h5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/picmark /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 3.3.5 域名与 SSL 配置

1. 在域名服务商处添加 A 记录，指向服务器公网 IP
2. 安装 Certbot 申请免费 SSL 证书：

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

3. 按提示完成证书安装，Certbot 会自动修改 Nginx 配置并启用 HTTPS
4. 测试自动续期：

```bash
sudo certbot renew --dry-run
```

## 4. 移动设备访问测试

### 4.1 基础访问测试

1. 在手机浏览器（Safari / Chrome）中输入部署后的网址
2. 检查页面是否能正常加载
3. 测试上传图片、定位、取色、输入名单、生成下载等完整流程

### 4.2 多系统/浏览器测试清单

| 设备类型 | 推荐测试浏览器 |
|----------|----------------|
| iPhone | Safari、微信内置浏览器、Chrome |
| Android | Chrome、微信内置浏览器、QQ 浏览器、Edge |
| iPad / Android 平板 | Safari、Chrome |

### 4.3 微信分享测试

1. 将链接通过微信发送给朋友
2. 点击链接在微信内打开
3. 测试功能是否正常
4. 如微信内置浏览器限制文件下载，提示用户使用系统浏览器打开

### 4.4 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 页面空白 | 文件路径错误 | 检查 `index.html` 中 css/js 引用路径是否正确 |
| 无法上传图片 | 浏览器权限未开启 | 检查是否允许浏览器访问相册/文件 |
| 生成的 ZIP 无法下载 | 微信内置浏览器限制 | 在微信中点击右上角，选择"在浏览器打开" |
| 自定义字体不生效 | 字体文件格式不支持 | 使用 TTF 或 OTF 格式字体 |
| 布局错乱 | 浏览器缓存旧版 CSS | 强制刷新或清除缓存 |

## 5. 维护与更新策略

### 5.1 更新流程

1. 在本地修改 `index.html`、`css/style.css` 或 `js/app.js`
2. 本地预览测试无误
3. 重新上传/部署到服务器或对象存储
4. 手机端访问并验证

### 5.2 缓存管理

- 更新 CSS/JS 后，如果手机端仍显示旧版本，可在 URL 后加版本号：
  ```
  https://your-domain.com/?v=2
  ```
- 或在文件引用后加查询参数：
  ```html
  <link rel="stylesheet" href="css/style.css?v=2">
  ```

### 5.3 备份建议

- 保留一份完整的 `mobile-h5` 文件夹备份
- 重大更新前先在本地或测试域名验证，再覆盖生产环境

### 5.4 监控与反馈

- 让几个朋友分别用不同手机型号测试
- 收集问题后统一修复再部署
- 如访问量大，可考虑接入 CDN 提升加载速度

## 6. 快速检查清单

部署完成后，确认以下事项：

- [ ] 手机浏览器能正常打开页面
- [ ] 页面布局无错乱
- [ ] 能上传底图
- [ ] 能点击定位和取色
- [ ] 能输入名单并生成 ZIP
- [ ] ZIP 能正常下载并解压
- [ ] 微信内可正常访问（下载异常时提示用浏览器打开）
- [ ] HTTPS 已启用（生产环境推荐）
