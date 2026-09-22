# -*- coding: utf-8 -*-
"""一键刷新并发布（汇报前用这个）：

  1) 拉最新数据（BI报表55 单量 + banner-stat 广告 + 企微素材）-> data/dashboard.json
  2) 清理「上一轮」的中间缓存（ads_raw / qiwei_raw / *.log），避免越积越大
     （最终数据都在 dashboard.json 里，中间断点缓存刷新完就没用了）
  3) 发布到 GitHub Pages

用法：  python refresh_all.py
"""
import subprocess, sys, os, shutil, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = r"D:\新建文件夹\workbuddy\工作PPT\两周周报_9_1_9_12"
PY = sys.executable


def run(args):
    print(">>", " ".join(args))
    subprocess.run([PY, "-u"] + args, cwd=HERE, check=True)


def clean():
    removed = []
    for d in ["ads_raw", "qiwei_raw"]:
        p = os.path.join(SRC, d)
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)
            removed.append(p)
    for f in glob.glob(os.path.join(HERE, "*.log")):
        try:
            os.remove(f); removed.append(f)
        except OSError:
            pass
    return removed


def main():
    run(["build_data.py", "--refresh"])
    run(["push_api.py"])
    print("\n== 清理中间缓存 ==")
    r = clean()
    print("\n".join("  - " + x for x in r) if r else "  （无可清理项）")
    out = os.path.join(HERE, "data", "dashboard.json")
    if os.path.exists(out):
        print("最终数据：%s （%.1f MB）" % (out, os.path.getsize(out) / 1024 / 1024))
    print("完成：数据已刷新并发布到 GitHub Pages")


if __name__ == "__main__":
    main()
