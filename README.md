# QSYL Web1

总后台端和医生端前端重构仓库。

## Included

- `apps/admin`: 总后台 Web 页面，默认端口 `3003`
- `apps/clinic`: 医生端/门店端 Web 页面，默认端口 `3002`
- `apps/shared`: 两端共享的 API、确认弹窗和公共样式

## Development

```bash
npm install
npm run dev:admin
npm run dev:clinic
```

默认 API 代理到 `http://127.0.0.1:3004`。如需指向其他后端：

```bash
$env:VITE_API_PROXY_TARGET="http://127.0.0.1:3004"
$env:VITE_API_BASE_URL=""
```

## Build

```bash
npm run build
```
