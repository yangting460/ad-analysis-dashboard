# 选股王 / 高端版 · 广告×成交 可视化分析面板

纯静态面板（HTML + ECharts），部署到 GitHub Pages 后，任何电脑浏览器打开链接即可看，无需安装。

## 目录结构
```
index.html            # 单页面板
js/app.js             # ECharts 渲染 + 交互
data/dashboard.json   # 聚合数据（由 build_data.py 生成）
build_data.py         # 本机拉数/聚合脚本
```

## 模块
- ① 核心 KPI：本月新开升级 / 选股王 单量 + 环比(变化数值)
- ② 分组×渠道 环比对比表（9月 vs 8月，变化数值，红涨绿跌，CTR=点击用户/曝光用户）
- ③ 每日成交分布（可切年/月 + 彩蛋红区 + 工作日零单标注）
- ④ 彩蛋活动专项（四档对照 + 同力度 YoY）
- ⑤ 周末/工作日规律（双零周末 vs 工作日零单预警）
- ⑥ 素材深挖（待接入 banner-stat 素材明细）

## 本地预览
```bash
cd 分析面板
python -m http.server 8099
# 浏览器打开 http://127.0.0.1:8099/index.html
```

## 刷新数据（阶段2 已支持真实拉数）
```bash
# 用本地缓存快速生成（离线可用，推荐平时用）
python build_data.py

# 拉真实数据刷新：BI报表55(问题ID898) 签名 + 广告后台 banner-stat（含 PC 650×300 剔除）
python build_data.py --refresh
```
- BI55 用 `后台导出/_token.txt` 的 JWT 签名直采；banner-stat 用 `C:/Users/admin/zt_token.txt` 的令牌。
- 环比口径：本月 1 日~今日 vs 上月 1 日~上月同日（天数对等），自动取最新月份。
- 刷新会自动更新 `data/dashboard.json`，随后运行 `python push_api.py` 即可发布到 GitHub Pages（见下）。

## 线上地址（已部署）
**https://yangting460.github.io/ad-analysis-dashboard/**
任何电脑浏览器打开即可，无需安装。

## 日常更新（本机）
```bash
# 1) 刷新数据（真实拉数 / 或用缓存）
python build_data.py --refresh

# 2) 发布到 GitHub Pages（API 方式，无需 git push）
python push_api.py
```
> 说明：本机网络对 `github.com` 的 git 协议路径有 DPI 拦截，`git push` 走不通，
> 因此用 `push_api.py` 走 GitHub REST API（`PUT /contents`）发布，效果等价。
> `push_api.py` 已从 GCM 读取你的 GitHub 登录态（或设置环境变量 `GITHUB_TOKEN`），不含明文密钥，已被 `.gitignore` 排除。

## 关于仓库可见性
仓库为**公开**（GitHub 免费计划的私有仓库不支持 Pages）。面板数据均为**聚合业务指标**
（每日单量 / CTR / 率，不含账号级个人信息），`build_data.py` 中仅引用 token 文件路径、不含真实密钥，可安全公开。
若需改为私有，请升级 GitHub 计划后转私有，或改用 CloudStudio / 隧道方式托管。

## 数据口径（固化）
- 单量：BI报表55（问题ID 898 新开发线上支付账号查询）全口径；新开升级按「结果产品」归类。
- CTR = count_access_user / count_show_user；点击购买率 = count_main_button_user / count_access_user。
- PC弹窗已剔除 650×300 小弹窗；普通广告不统计曝光 → 显示「无数据」。
- 日均按自然日历天数；2026年9月数据截至 09-18（同月基线限制在数据范围内）。
