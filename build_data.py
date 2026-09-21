# -*- coding: utf-8 -*-
"""阶段2：支持 --refresh 拉真实数据；默认用本地缓存生成 data/dashboard.json。

用法：
  python build_data.py            # 用已有缓存(bi55_2025/2026, ctr_mom)生成面板数据
  python build_data.py --refresh  # 先拉 BI报表55(问题ID898) + 广告后台banner-stat 真实数据，再生成

口径固化：
  - 单量：BI报表55 全口径；新开升级按「结果产品」归类
  - CTR = count_access_user / count_show_user；点击购买率 = count_main_button_user / count_access_user
  - PC弹窗(bt=4) 剔除 650×300 小弹窗（pcid_dims.json 缓存尺寸，未知则实时测）
  - 普通广告(bt=1) 不统计曝光 → 显示「无数据」
  - 环比：本月1日~今日 vs 上月1日~上月同日（天数对等）
"""
import json, os, sys, time
from collections import Counter, defaultdict
from datetime import date, timedelta
import urllib.request
from urllib.parse import urlencode

SRC = r"D:\新建文件夹\workbuddy\工作PPT\两周周报_9_1_9_12"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "dashboard.json")
PCID_FILE = os.path.join(SRC, "pcid_dims.json")
BI_TOKEN = open(r"D:/新建文件夹/workbuddy/工作PPT/后台导出/_token.txt", encoding="utf-8").read().strip()
AD_TOKEN = open(r"C:/Users/admin/zt_token.txt", encoding="utf-8").read().strip()

GROUPS = {"选股王": 37, "新开升级": 53}
TYPES = {1: "普通广告", 2: "APP弹窗广告", 3: "APP通知栏推送", 4: "PC弹窗推送"}
FIELDS = ["count_show_user", "count_access_user", "count_main_button_user"]
pcid = json.load(open(PCID_FILE, encoding="utf-8")) if os.path.exists(PCID_FILE) else {}


def classify(n):
    if "升级" in n:
        a = n.split("升级", 1)[1]
        return "选股王" if "选股王" in a else "新开升级"
    return "选股王" if "选股王" in n else "新开升级"


# ---------------- BI报表55 ----------------
def load_bi55_local(fn, ymax=None):
    path = os.path.join(SRC, fn)
    if not os.path.exists(path):
        return None
    d = json.load(open(path, encoding="utf-8"))
    rows = d["data"]["rows"]
    by = defaultdict(Counter)
    for r in rows:
        dd = r[3][:10]
        if ymax and dd > ymax:
            continue
        by[dd][classify(r[0])] += 1
    return by


def refresh_bi55(year, end):
    sign = urllib.request.urlopen(urllib.request.Request(
        "https://gw.n8n8.cn/n8sf/api/manage/report/bi-sheet/generate-access-info",
        data=json.dumps({"id": 55}).encode(),
        headers={"Authorization": "Bearer %s" % BI_TOKEN, "Content-Type": "application/json",
                 "Accept": "application/json"}, method="POST"), timeout=30).read()
    jwt = json.loads(sign)["response"]["token"]["token"]
    url = "https://bi.jingzhuan.cn/api/embed/card/%s/query?startTime=%s-01-01&endTime=%s" % (jwt, year, end)
    data = json.loads(urllib.request.urlopen(
        urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=60).read())
    fn = "bi55_%s.json" % year
    json.dump(data, open(os.path.join(SRC, fn), "w", encoding="utf-8"), ensure_ascii=False)
    print("  saved", fn, "rows", len(data["data"]["rows"]))
    return load_bi55_local(fn)


# ---------------- 广告后台 banner-stat ----------------
def get_dim(url):
    if url in pcid:
        return pcid[url]
    try:
        from PIL import Image
        from io import BytesIO
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0",
                                                    "Referer": "https://zt.jingzhuan.cn/"})
        im = Image.open(BytesIO(urllib.request.urlopen(req, timeout=30).read()))
        w, h = im.size
    except Exception:
        w = h = -1
    pcid[url] = [w, h]
    return [w, h]


def is_small(url):
    w, h = pcid.get(url, [-1, -1])
    return (w, h) == (650, 300)


def ad_call(params):
    url = "https://gw.n8n8.cn/zhushou/api/report/banner-stat/list?" + urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + AD_TOKEN, "Origin": "https://zt.jingzhuan.cn",
        "Referer": "https://zt.jingzhuan.cn/", "Accept": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())


def fetch_all(gid, bt, st, en):
    rows, page = [], 1
    while True:
        r = ad_call({"page": page, "limit": 100, "banner_group_id": gid,
                     "banner_type": bt, "start_time": st, "end_time": en})
        if not r.get("response"):
            print("  !异常返回:", r.get("code"), r.get("msg"))
            break
        dl = r["response"]["data"]["data_list"]
        rows.extend(dl)
        if len(dl) < 100:
            break
        page += 1
        time.sleep(0.05)
    return rows


def agg(rows):
    s = {f: 0 for f in FIELDS}
    for d in rows:
        for f in FIELDS:
            try:
                s[f] += int(d.get(f) or 0)
            except (TypeError, ValueError):
                pass
    return s


def refresh_banner_stat(cur_st, cur_en, prev_st, prev_en):
    result = {}
    for gname, gid in GROUPS.items():
        result[gname] = {}
        for bt, tname in TYPES.items():
            result[gname][tname] = {}
            for tag, (st, en) in (("cur", (cur_st, cur_en)), ("prev", (prev_st, prev_en))):
                rows = fetch_all(gid, bt, st, en)
                if bt == 4:
                    for d in rows:
                        if d.get("image") and d["image"] not in pcid:
                            get_dim(d["image"])
                    normal = [d for d in rows if not is_small(d.get("image", ""))]
                    a = agg(normal)
                else:
                    a = agg(rows)
                result[gname][tname][tag] = a
                print("  %s-%s[%s] 行%d 曝光=%d 点击=%d 点击购买=%d"
                      % (gname, tname, tag, len(rows), a["count_show_user"],
                         a["count_access_user"], a["count_main_button_user"]))
                time.sleep(0.05)
    json.dump(pcid, open(PCID_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    return result


# ---------------- 彩蛋（历史固化窗口）----------------
def count(by, sd, ed):
    c = Counter()
    cur = date(*map(int, sd.split('-')))
    b = date(*map(int, ed.split('-')))
    while cur <= b:
        cnt = by.get(cur.isoformat(), Counter())
        c["新开升级"] += cnt["新开升级"]
        c["选股王"] += cnt["选股王"]
        cur += timedelta(days=1)
    n = (b - date(*map(int, sd.split('-')))).days + 1
    return c, n


def month_non(by, sd, ed, ymax=None):
    m = sd[:7]
    mo = int(m[5:7])
    y = int(m[:4])
    eom = date(y, mo, 28 if mo == 2 else 30 if mo in (4, 6, 9, 11) else 31)
    if ymax:
        eom = min(eom, date(*map(int, ymax.split('-'))))
    c = Counter()
    n = 0
    cur = date(y, mo, 1)
    while cur <= eom:
        dd = cur.isoformat()
        if not (sd <= dd <= ed):
            cnt = by.get(dd, Counter())
            c["新开升级"] += cnt["新开升级"]
            c["选股王"] += cnt["选股王"]
            n += 1
        cur += timedelta(days=1)
    return c, n


def build_caidan(by25, by26, ymax):
    periods = [
        ("2025 9/8-9/12", "多减300元(减完最高减3800)·同力度", "2025-09-08", "2025-09-12", by25, None),
        ("3/9-3/13", "减钱500元(减完最高减3500)", "2026-03-09", "2026-03-13", by26, ymax),
        ("6/18 单日", "多送2个月(减钱本身最高减3500)", "2026-06-18", "2026-06-18", by26, ymax),
        ("9/14-9/16 本轮", "多减300元(减完最高减3800)·同力度", "2026-09-14", "2026-09-16", by26, ymax),
    ]
    out = []
    for name, desc, sd, ed, by, ym in periods:
        if by is None:
            out.append(dict(name=name, desc=desc, sd=sd, ed=ed, n=0,
                            xk=0, xk_avg=0, base=0, diff=0, xg_avg=0, xg_diff=0, daily=[]))
            continue
        c, n = count(by, sd, ed)
        bc, bn = month_non(by, sd, ed, ym)
        xk_avg = c["新开升级"] / n
        base = bc["新开升级"] / bn
        xg_avg = c["选股王"] / n
        xg_base = bc["选股王"] / bn
        cur = date(*map(int, sd.split('-')))
        b = date(*map(int, ed.split('-')))
        daily = []
        while cur <= b:
            dd = cur.isoformat()
            cnt = by.get(dd, Counter())
            daily.append({"d": dd[5:], "xk": cnt["新开升级"], "xg": cnt["选股王"]})
            cur += timedelta(days=1)
        out.append(dict(name=name, desc=desc, sd=sd, ed=ed, n=n,
                        xk=c["新开升级"], xk_avg=round(xk_avg, 2), base=round(base, 2),
                        diff=round(xk_avg - base, 2),
                        xg_avg=round(xg_avg, 2), xg_diff=round(xg_avg - xg_base, 2),
                        daily=daily))
    return out


# ---------------- 主流程 ----------------
def main():
    refresh = "--refresh" in sys.argv
    today = date.today()

    print("== 载入 BI报表55 缓存 ==")
    by25 = load_bi55_local("bi55_2025.json")
    by26 = load_bi55_local("bi55_full_fresh.json", today.isoformat())
    if refresh:
        print("== 刷新 BI报表55 真实数据 ==")
        by25 = refresh_bi55(2025, "2025-12-31")
        by26 = refresh_bi55(2026, today.isoformat())

    bi55_daily = {}
    for by in (by25 or {}, by26 or {}):
        for dd, c in by.items():
            bi55_daily[dd] = {"xk": c["新开升级"], "xg": c["选股王"]}

    months = sorted(set(d[:7] for d in bi55_daily))
    cur_m = months[-1]
    cy, cm = map(int, cur_m.split('-'))
    prev_m = "%d-%02d" % (cy - 1, 12) if cm == 1 else "%d-%02d" % (cy, cm - 1)

    # 分组×渠道环比
    if refresh:
        print("== 刷新 广告后台 banner-stat 真实数据 ==")
        cur_st = "%s-01 00:00" % cur_m
        cur_en = today.strftime("%Y-%m-%d") + " 23:59"
        if cm == 1:
            pym, pd = cy - 1, 12
        else:
            pym, pd = cy, cm - 1
        prev_st = "%d-%02d-01 00:00" % (pym, pd)
        prev_en = "%d-%02d-%02d 23:59" % (pym, pd, today.day)
        ctr = refresh_banner_stat(cur_st, cur_en, prev_st, prev_en)
        ctr_periods = {"cur": cur_m, "prev": prev_m}
    else:
        print("== 载入 banner-stat 缓存(ctr_mom.json) ==")
        raw = json.load(open(os.path.join(SRC, "ctr_mom.json"), encoding="utf-8"))
        # 兼容旧结构 sep/aug
        if "_meta" in raw:
            ctr = raw
            ctr_periods = raw["_meta"]
        else:
            ctr = {}
            for g in GROUPS:
                ctr[g] = {}
                for ch in TYPES.values():
                    ctr[g][ch] = {"cur": raw[g][ch]["9月"], "prev": raw[g][ch]["8月"]}
            ctr_periods = {"cur": "2026-09", "prev": "2026-08"}
    ctr["_meta"] = ctr_periods

    caidan = build_caidan(by25, by26, today.isoformat())

    out = {
        "updated": today.isoformat(),
        "source": "BI报表55(问题ID898) + 广告后台banner-stat 实时/缓存",
        "note": "CTR=点击用户/曝光用户；点击购买率=点击购买用户/点击用户；PC弹窗已剔除650×300小弹窗；普通广告无曝光显示无数据；环比=本月至今vs上月同期(天数对等)",
        "kpi_periods": {"cur": cur_m, "prev": prev_m},
        "ctr_periods": ctr_periods,
        "bi55_daily": bi55_daily,
        "caidan": caidan,
        "ctr_mom": ctr,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("written", OUT, "| 天数:", len(bi55_daily), "| 环比本期:", cur_m, "上期:", prev_m,
          "| 彩蛋档:", len(caidan))


if __name__ == "__main__":
    main()
