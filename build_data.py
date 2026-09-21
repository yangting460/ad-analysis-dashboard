# -*- coding: utf-8 -*-
"""面板数据构建：BI报表55(单量) + 广告后台banner-stat(广告/链接/素材)。

用法：
  python build_data.py            # 用本地缓存快速生成
  python build_data.py --refresh  # 真实拉 BI55 + banner-stat（按天入库）

输出 data/dashboard.json 关键结构：
  bi55_daily        {date: {xk, xg}}                      单量(2025+2026 合并)
  bi55_device_daily {date: {xk:{dev:cnt}, xg:{dev:cnt}}}  端分布
  targets           {yearly:{xk,xg}, monthly:{"YYYY-MM":{xk,xg}}}   目标(targets.json)
  ads_daily         {date: {group: {ch: {show,acc,mb,ord,deal}}}}  广告按天(便于日/周/月/季聚合)
  ad_creatives      {img: {title,url}}                    素材元信息
  ads_rows          [{d,g,t,i,show,acc,mb,ord}]           素材级明细(show>=MIN_SHOW)
  caidan            [...]                                 彩蛋专项

口径：CTR=count_access_user/count_show_user；点击购买率=count_main_button_user/count_access_user
      PC弹窗(bt=4) 剔除650×300 -> ch="PC弹窗推送"；小弹窗单列 ch="PC小弹窗"
"""
import json, os, sys, time
from collections import Counter, defaultdict
from datetime import date, timedelta
import urllib.request
from urllib.parse import urlencode

SRC = r"D:\新建文件夹\workbuddy\工作PPT\两周周报_9_1_9_12"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "dashboard.json")
TARGETS_FILE = os.path.join(HERE, "targets.json")
PCID_FILE = os.path.join(SRC, "pcid_dims.json")
RAW_DIR = os.path.join(SRC, "ads_raw")
QI_DIR = os.path.join(SRC, "qiwei_raw")
QI_BASE = "https://gw.n8n8.cn/enterprisewechatAssistant/api/enterprisewechat/manage"
QI_SORT = {"升级高端版": 1, "选股王": 4}  # 栏目 sort_id；升级高端版=新开升级
QI_CREATOR = "杨婷"
BI_TOKEN = open(r"D:/新建文件夹/workbuddy/工作PPT/后台导出/_token.txt", encoding="utf-8").read().strip()
AD_TOKEN = open(r"C:/Users/admin/zt_token.txt", encoding="utf-8").read().strip()

GROUPS = {"选股王": 37, "新开升级": 53}
TYPES = {1: "普通广告", 2: "APP弹窗广告", 3: "APP通知栏推送", 4: "PC弹窗推送"}
CHANNELS = ["普通广告", "APP弹窗广告", "APP通知栏推送", "PC弹窗推送", "PC小弹窗"]
DEVICES = ["Android", "iOS", "H5", "web", "soft"]
MIN_SHOW = 100  # 素材明细只保留曝光>=100 的行，控制体积
pcid = json.load(open(PCID_FILE, encoding="utf-8")) if os.path.exists(PCID_FILE) else {}


def classify(n):
    if "升级" in n:
        a = n.split("升级", 1)[1]
        return "选股王" if "选股王" in a else "新开升级"
    return "选股王" if "选股王" in n else "新开升级"


# ---------------- BI报表55 ----------------
def load_bi55_rows(fn, ymax=None):
    path = os.path.join(SRC, fn)
    if not os.path.exists(path):
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for r in d["data"]["rows"]:
        dd = r[3][:10]
        if ymax and dd > ymax:
            continue
        out.append((dd, classify(r[0]), r[1]))
    return out


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
    return load_bi55_rows(fn)


# ---------------- 广告后台 ----------------
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
    return tuple(pcid.get(url, [-1, -1])) == (650, 300)


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


def num(d, k):
    try:
        return int(d.get(k) or 0)
    except (TypeError, ValueError):
        return 0


def refresh_ads(st, en):
    ads_daily = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: Counter())))
    creatives = {}
    ads_rows = []
    total = 0
    os.makedirs(RAW_DIR, exist_ok=True)
    force = "--force" in sys.argv
    for gname, gid in GROUPS.items():
        for bt, tname in TYPES.items():
            fp = os.path.join(RAW_DIR, "%s_%d.json" % (gname, bt))
            if os.path.exists(fp) and not force:
                rows = json.load(open(fp, encoding="utf-8"))
                print("  [cached] %s-%s 行%d" % (gname, tname, len(rows)))
            else:
                try:
                    rows = fetch_all(gid, bt, st, en)
                except Exception as e:
                    print("  !%s-%s 拉取失败: %s（重跑续传）" % (gname, tname, e))
                    continue
                json.dump(rows, open(fp, "w", encoding="utf-8"), ensure_ascii=False)
                print("  %s-%s 行%d (saved)" % (gname, tname, len(rows)))
            total += len(rows)
            for d in rows:
                dd = (d.get("time_info") or "")[:10]
                if not dd:
                    continue
                img = d.get("image") or ""
                if bt == 4:
                    if img and img not in pcid:
                        get_dim(img)
                    ch = "PC小弹窗" if is_small(img) else "PC弹窗推送"
                else:
                    ch = tname
                show, acc = num(d, "count_show_user"), num(d, "count_access_user")
                mb, od = num(d, "count_main_button_user"), num(d, "count_ordered")
                deal = num(d, "count_deal_user")
                c = ads_daily[dd][gname][ch]
                c["show"] += show; c["acc"] += acc; c["mb"] += mb; c["ord"] += od; c["deal"] += deal
                if show >= MIN_SHOW or od > 0:
                    if img:
                        creatives[img] = {"title": d.get("banner_title") or "", "url": d.get("jump_desc") or ""}
                    ads_rows.append({"d": dd, "g": gname, "t": ch, "i": img,
                                     "show": show, "acc": acc, "mb": mb, "ord": od})
            time.sleep(0.05)
    json.dump(pcid, open(PCID_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    # 转普通 dict
    ads = {}
    for dd, gd in ads_daily.items():
        ads[dd] = {}
        for g, cd in gd.items():
            ads[dd][g] = {ch: dict(v) for ch, v in cd.items()}
    missing = [(g, bt) for g in GROUPS for bt in TYPES
               if not os.path.exists(os.path.join(RAW_DIR, "%s_%d.json" % (g, bt)))]
    print("  广告按天入库: 天数=%d 明细行=%d(原%d) | 缺失渠道=%d" % (len(ads), len(ads_rows), total, len(missing)))
    return ads, creatives, ads_rows, missing


# ---------------- 企微素材（运营后台·企业微信·素材管理）----------------
def qi_cate(params):
    url = QI_BASE + "/material/list?" + urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + AD_TOKEN, "Origin": "https://zt.jingzhuan.cn",
        "Referer": "https://zt.jingzhuan.cn/", "Accept": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())


def refresh_qiwei():
    os.makedirs(QI_DIR, exist_ok=True)
    force = "--force" in sys.argv
    out = {}   # date -> {xk:{n,use}, xg:{n,use}}  xk=升级高端版, xg=选股王
    mats = {"xk": [], "xg": []}   # 素材明细 [date, use, title]
    miss = 0
    for name, sid in QI_SORT.items():
        fp = os.path.join(QI_DIR, "%s.json" % name)
        if os.path.exists(fp) and not force:
            rows = json.load(open(fp, encoding="utf-8"))
            print("  [cached] 企微-%s 行%d" % (name, len(rows)))
        else:
            rows, page = [], 1
            try:
                while True:
                    r = qi_cate({"page": page, "limit": 100, "sort_id": sid})
                    if not r.get("response"):
                        print("  !企微-%s 异常: %s" % (name, r.get("msg")))
                        break
                    dl = r["response"]["data"]
                    rows.extend(dl)
                    if len(dl) < 100:
                        break
                    page += 1
                    time.sleep(0.05)
            except Exception as e:
                print("  !企微-%s 拉取失败: %s（重跑续传）" % (name, e))
                miss += 1
                continue
            json.dump(rows, open(fp, "w", encoding="utf-8"), ensure_ascii=False)
            print("  企微-%s 行%d (saved)" % (name, len(rows)))
        key = "xg" if name == "选股王" else "xk"
        for d in rows:
            if d.get("creator_name") != QI_CREATOR:
                continue
            dd = (d.get("created_at") or "")[:10]
            if not dd:
                continue
            try:
                uc = int(d.get("use_count") or 0)
            except (TypeError, ValueError):
                uc = 0
            o = out.setdefault(dd, {}).setdefault(key, {"n": 0, "use": 0})
            o["n"] += 1
            o["use"] += uc
            title = (d.get("content") or "").replace("\n", " ").strip()[:40]
            mats[key].append([dd, uc, title])
    print("  企微素材入库: 天数=%d | 明细 xk=%d xg=%d | 缺失=%d"
          % (len(out), len(mats["xk"]), len(mats["xg"]), miss))
    return out, mats


# ---------------- 彩蛋 ----------------
def count(by, sd, ed):
    c = Counter()
    cur = date(*map(int, sd.split('-')))
    b = date(*map(int, ed.split('-')))
    while cur <= b:
        cnt = by.get(cur.isoformat(), Counter())
        c["新开升级"] += cnt["新开升级"]; c["选股王"] += cnt["选股王"]
        cur += timedelta(days=1)
    n = (b - date(*map(int, sd.split('-')))).days + 1
    return c, n


def month_non(by, sd, ed, ymax=None):
    m = sd[:7]; mo = int(m[5:7]); y = int(m[:4])
    eom = date(y, mo, 28 if mo == 2 else 30 if mo in (4, 6, 9, 11) else 31)
    if ymax:
        eom = min(eom, date(*map(int, ymax.split('-'))))
    c = Counter(); n = 0; cur = date(y, mo, 1)
    while cur <= eom:
        dd = cur.isoformat()
        if not (sd <= dd <= ed):
            cnt = by.get(dd, Counter())
            c["新开升级"] += cnt["新开升级"]; c["选股王"] += cnt["选股王"]; n += 1
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
            out.append(dict(name=name, desc=desc, sd=sd, ed=ed, n=0, xk=0, xk_avg=0,
                            base=0, diff=0, xg_avg=0, xg_diff=0, daily=[]))
            continue
        c, n = count(by, sd, ed)
        bc, bn = month_non(by, sd, ed, ym)
        xk_avg = c["新开升级"] / n
        cur = date(*map(int, sd.split('-')))
        b = date(*map(int, ed.split('-')))
        daily = []
        while cur <= b:
            dd = cur.isoformat(); cnt = by.get(dd, Counter())
            daily.append({"d": dd[5:], "xk": cnt["新开升级"], "xg": cnt["选股王"]})
            cur += timedelta(days=1)
        out.append(dict(name=name, desc=desc, sd=sd, ed=ed, n=n, xk=c["新开升级"],
                        xk_avg=round(xk_avg, 2), base=round(bc["新开升级"] / bn, 2),
                        diff=round(xk_avg - bc["新开升级"] / bn, 2),
                        xg_avg=round(c["选股王"] / n, 2),
                        xg_diff=round(c["选股王"] / n - bc["选股王"] / bn, 2), daily=daily))
    return out


def load_targets():
    if os.path.exists(TARGETS_FILE):
        return json.load(open(TARGETS_FILE, encoding="utf-8"))
    tpl = {"_note": "在此填单量目标；monthly 键为 YYYY-MM，缺省表示未配置",
           "yearly": {"2026": {"xk": 0, "xg": 0}},
           "monthly": {"2026-09": {"xk": 0, "xg": 0}}}
    json.dump(tpl, open(TARGETS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return tpl


# ---------------- 主流程 ----------------
def main():
    refresh = ("--refresh" in sys.argv) or ("--qiwei" in sys.argv) or ("--ads" in sys.argv)
    today = date.today()
    ymax = today.isoformat()

    print("== BI报表55 ==")
    rows = load_bi55_rows("bi55_2025.json") + load_bi55_rows("bi55_full_fresh.json", ymax)
    if refresh:
        rows = refresh_bi55(2025, "2025-12-31") + refresh_bi55(2026, ymax)

    bi55_daily = defaultdict(lambda: {"xk": 0, "xg": 0})
    dev_daily = defaultdict(lambda: {"xk": Counter(), "xg": Counter()})
    GK = {"新开升级": "xk", "选股王": "xg"}
    for dd, g, dev in rows:
        k = GK[g]
        bi55_daily[dd][k] += 1
        dev_daily[dd][k][dev] += 1
    bi55_daily = {k: dict(v) for k, v in bi55_daily.items()}
    dev = {dd: {"xk": dict(v["xk"]), "xg": dict(v["xg"])} for dd, v in dev_daily.items()}

    # 广告窗口：往前 5 个月（覆盖本季 + 上季，支持周/月/季环比）
    y, m = today.year, today.month
    sm = m - 5; sy = y
    while sm <= 0:
        sm += 12; sy -= 1
    ads_st = "%d-%02d-01 00:00" % (sy, sm)
    ads_en = today.strftime("%Y-%m-%d") + " 23:59"

    do_ads = refresh and ("--qiwei" not in sys.argv)
    do_qi = refresh and ("--ads" not in sys.argv)
    ADS_CACHE = os.path.join(SRC, "ads_cache.json")
    QI_CACHE = os.path.join(SRC, "qiwei_cache.json")

    if do_ads:
        print("== banner-stat 真实拉取（%s ~ %s）==" % (ads_st, ads_en))
        ads, creatives, ads_rows, missing = refresh_ads(ads_st, ads_en)
        json.dump({"ads_daily": ads, "ad_creatives": creatives, "ads_rows": ads_rows},
                  open(ADS_CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    elif os.path.exists(ADS_CACHE):
        print("== 载入 banner-stat 缓存 ==")
        c = json.load(open(ADS_CACHE, encoding="utf-8"))
        ads, creatives, ads_rows = c["ads_daily"], c["ad_creatives"], c["ads_rows"]
    else:
        print("== 无广告缓存 ==")
        ads, creatives, ads_rows = {}, {}, []

    if do_qi:
        print("== 企微素材拉取 ==")
        qi, qi_mats = refresh_qiwei()
        json.dump({"daily": qi, "materials": qi_mats}, open(QI_CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    elif os.path.exists(QI_CACHE):
        c = json.load(open(QI_CACHE, encoding="utf-8"))
        if "daily" in c:
            qi, qi_mats = c["daily"], c.get("materials", {"xk": [], "xg": []})
        else:
            qi, qi_mats = c, {"xk": [], "xg": []}
    else:
        qi, qi_mats = {}, {"xk": [], "xg": []}

    # 单量按天（含两年）取并集日期
    out = {
        "updated": ymax,
        "source": "BI报表55(问题ID898) + 广告后台banner-stat + 企微素材管理",
        "note": "CTR=点击用户/曝光用户；点击购买率=点击购买用户/点击用户；PC弹窗已剔除650×300(小弹窗单列)；普通广告无曝光=无数据；周=周一到周日(可切滚动周)；单量可同比(2025有数据)，广告仅环比",
        "channels": CHANNELS,
        "devices": DEVICES,
        "bi55_daily": bi55_daily,
        "bi55_device_daily": dev,
        "targets": load_targets(),
        "ads_daily": ads,
        "ad_creatives": creatives,
        "ads_rows": ads_rows,
        "qiwei_daily": qi,
        "qiwei_materials": qi_mats,
        "caidan": build_caidan(
            {d: Counter({"新开升级": v["xk"], "选股王": v["xg"]}) for d, v in bi55_daily.items() if d < "2026-01-01"},
            {d: Counter({"新开升级": v["xk"], "选股王": v["xg"]}) for d, v in bi55_daily.items() if d >= "2026-01-01"},
            ymax),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    sz = os.path.getsize(OUT) / 1024
    print("written %s | 单量天数=%d 广告天数=%d 素材行=%d | %.0f KB"
          % (OUT, len(bi55_daily), len(ads), len(ads_rows), sz))


if __name__ == "__main__":
    main()
