# 选股王 / 高端版 · 广告×成交 可视化分析面板

纯静态面板（HTML + ECharts），部署到 GitHub Pages 后，任何电脑浏览器打开链接即可看，无需安装。

## 目录结构
```
index.html            # 单页面板
js/app.js             # ECharts 渲染 + 交互 + 多粒度引擎
data/dashboard.json   # 聚合数据（由 build_data.py 生成）
build_data.py         # 本机拉数/聚合脚本
targets.json          # 单量月度/年度目标（自行填写，用于达成率）
push_api.py           # 发布到 GitHub（Git Data API）
```

## 使用方式：先明确产品
顶部醒目按钮 **【先明确产品】**（新开升级（高端版） / 选股王）。选定后，单量/广告/跳转链接/素材等**全部只显示该产品**的数据（不再两个产品混在一起）。

## 模块（按 Tab）
- **首页**：本周 vs 上周（固定周）速览 —— 单量、APP弹窗、PC弹窗、普通广告、PUSH、企微素材，逐个显示本周值+变化数值；附近12周单量趋势、各渠道本周点击。
- **单量**：核心 KPI（本期 / 环比 / 同比 **分开展示**）+ 单量趋势 + 端分布 + 目标达成（仅当前产品）
- **广告**：渠道环比总表 + **每个渠道独立明细块**（各自数据表 + 该渠道按粒度趋势图；PC弹窗含大/小弹窗拆分）
- **跳转链接**：按落地页归一聚合，购买率排行 + 明细表 + 三类问题识别
- **素材**：各渠道 TOP5 / BOTTOM5（仅工作日、按 CTR、自适应最小曝光阈值，附广告图）
- **活动/规律**：**企微素材**（杨婷 · 选股王 / 升级高端版，新增条数与使用次数）+ 彩蛋专项 + 周末/工作日规律

**时间粒度**：日 / 周(固定 周一~周日) / 周(滚动 最近7天) / 月 / 季；单量支持同比(2025有数据)，广告仅环比。
**默认基准日** = 最近一个完整周的周日（避免周一打开时"本周"才刚开始）。

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

# 拉真实数据刷新（BI报表55 + banner-stat + 企微素材）
python build_data.py --refresh

# 只刷企微素材（广告沿用缓存）/ 只刷广告（企微沿用缓存）
python build_data.py --qiwei
python build_data.py --ads
```
- BI55 用 `后台导出/_token.txt` 的 JWT 签名直采；banner-stat / 企微素材 用 `C:/Users/admin/zt_token.txt` 的令牌。
- 广告按「每广告×每天」入库（近 6 个月），支持任意粒度聚合；PC 弹窗按尺寸拆「大弹窗 / 小弹窗(650×300)」。
- 企微素材来自运营后台 `enterprisewechatAssistant/.../material/list`，按栏目(`sort_id` 1=升级高端版 / 4=选股王) + 创建人=杨婷。
- **断点续传**：广告按「分组×渠道」存 `两周周报_9_1_9_12/ads_raw/`，企微按栏目存 `qiwei_raw/`，中断后重跑跳过已完成。
- 刷新会自动更新 `data/dashboard.json`，随后运行 `python push_api.py` 即可发布（见下）。

## 线上地址（已部署）
**https://yangting460.github.io/ad-analysis-dashboard/**
任何电脑浏览器打开即可，无需安装。

## 汇报前刷新（推荐：一条命令搞定）
```bash
cd 分析面板
python refresh_all.py
```
它会依次：① 拉最新数据（BI55 + 广告 + 企微素材）生成 `data/dashboard.json`；② **清理上一轮的中间缓存**（`ads_raw/`、`qiwei_raw/`、`*.log`），避免越占越多；③ 发布到 GitHub Pages。
刷新完直接打开线上链接（或本地 `http://127.0.0.1:8099`）即可看到最新数据。

> 手动分步（等价）：
> ```bash
> python build_data.py --refresh   # 拉数
> python push_api.py               # 发布
> ```
> 只刷某一类：`python build_data.py --qiwei`（仅企微，广告用缓存）/ `--ads`（仅广告）。
> 说明：本机网络对 `github.com` 的 git 协议路径有 DPI 拦截，`git push` 走不通，
> 因此用 `push_api.py` 走 GitHub **Git Data API**（blob -> tree -> commit -> ref）发布，支持 >1MB 大文件。
> `push_api.py` 从 GCM 读取你的 GitHub 登录态（或设置环境变量 `GITHUB_TOKEN`），不含明文密钥，已被 `.gitignore` 排除。

## 关于仓库可见性
仓库为**公开**（GitHub 免费计划的私有仓库不支持 Pages）。面板数据均为**聚合业务指标**
（每日单量 / CTR / 率，不含账号级个人信息），`build_data.py` 中仅引用 token 文件路径、不含真实密钥，可安全公开。
若需改为私有，请升级 GitHub 计划后转私有，或改用 CloudStudio / 隧道方式托管。

## 数据口径（固化）
- 单量：BI报表55（问题ID 898 新开发线上支付账号查询）全口径；新开升级按「结果产品」归类。
- CTR = count_access_user / count_show_user；点击购买率 = count_main_button_user / count_access_user。
- PC弹窗已剔除 650×300 小弹窗；普通广告不统计曝光 → 显示「无数据」。
- 日均按自然日历天数；同月基线限制在数据范围内（无数据日不计入）。
