#!/usr/bin/env python3
"""生成微信小程序图标资源：
  1) tabBar 图标（81x81 PNG，4 倍超采样后缩放保证边缘平滑）；
  2) 小程序头像（144x144 / 512x512 PNG）—— 提审时需在 mp 后台上传。

小程序 tabBar 必须使用本地图片资源（不支持 SVG / iconfont），
这里用几何图形绘制线性风格图标，与 App 端的极简视觉语言保持一致。
"""
import math
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "tabs")
SIZE = 81          # 官方推荐尺寸
SS = 4             # supersample factor

GREY = (138, 138, 138, 255)        # #8A8A8A 未选中
ACCENT = (78, 125, 18, 255)        # #4E7D12 选中（品牌绿深色变体）


def canvas():
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def finish(img, name):
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, "PNG")
    print("wrote", path, img.size)


def box(value, pad):
    """逻辑坐标系给定 + 画布边距"""
    return SIZE * SS * value / 81 * 1.0, pad


def draw_assets(d, color):
    """清单：左侧方块 + 三条横线"""
    L = SIZE * SS
    u = L / 81.0
    stroke = int(round(5.2 * u))
    x0 = 14 * u
    y0 = 15 * u
    d.rectangle([x0, y0, x0 + 12 * u, y0 + 12 * u], outline=color, width=stroke)
    for i in range(3):
        y = 21 * u + i * 17 * u
        d.line([34 * u, y, 67 * u, y], fill=color, width=stroke)
    # 第一行的短标
    d.line([x0 + 3 * u, 21 * u, x0 + 9 * u, 21 * u], fill=color, width=int(stroke * 0.8))


def draw_star(d, color):
    """五角星（心愿）"""
    L = SIZE * SS
    cx = cy = L / 2.0
    outer = 30 * (L / 81.0)
    inner = outer * 0.46
    points = []
    for i in range(10):
        angle = -math.pi / 2 + i * math.pi / 5
        r = outer if i % 2 == 0 else inner
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    d.polygon(points, fill=color)


def draw_bars(d, color):
    """柱状（趋势）"""
    L = SIZE * SS
    u = L / 81.0
    width = 11 * u
    heights = [0.42, 0.62, 0.9]
    base = 66 * u
    for i, h in enumerate(heights):
        left = 17 * u + i * 17 * u
        top = base - h * 40 * u
        d.rectangle([left, top, left + width, base], fill=color)
    d.line([12 * u, base + 5 * u, 70 * u, base + 5 * u], fill=color, width=int(round(4.4 * u)))


def draw_settings(d, color):
    """滑块调节（设置）：三条横线，各带一个圆形节点，位置错开。"""
    L = SIZE * SS
    u = L / 81.0
    stroke = int(round(5.2 * u))
    rows = [
        (24 * u, 26 * u),   # y, 节点 x
        (40.5 * u, 52 * u),
        (57 * u, 33 * u),
    ]
    for y, node_x in rows:
        d.line([14 * u, y, 67 * u, y], fill=color, width=stroke)
        r = 7.5 * u
        # 节点：白底圆 + 彩色描边，避免与横线糊在一起
        d.ellipse([node_x - r, y - r, node_x + r, y + r],
                  fill=(255, 255, 255, 255), outline=color, width=stroke)


def draw_app_icon(d, size, ss):
    """小程序头像：深绿底 + 白色物品清单方块 + 亮绿日均成本下降折线。

    微信会自动把头像四角裁成圆角，所以核心图形集中在中间 60% 安全区内。
    不使用任何「微信」「小程序」字样与二维码，符合头像审核规范。
    """
    L = size * ss
    u = L / 144.0  # 以 144 为逻辑画布
    d.rectangle([0, 0, L, L], fill=ACCENT)
    # 浅色高光角（极淡，增加层次）
    d.polygon([(0, 0), (L * 0.42, 0), (0, L * 0.42)], fill=(96, 143, 30, 255))

    white = (255, 255, 255, 255)
    lime = (155, 229, 46, 255)   # #9BE52E

    # 左侧：物品方块（白描边 + 内部小块）
    x0, y0 = 40 * u, 46 * u
    sw = int(round(5 * u))
    d.rectangle([x0, y0, x0 + 26 * u, y0 + 26 * u], outline=white, width=sw)
    d.rectangle([x0 + 6 * u, y0 + 6 * u, x0 + 12 * u, y0 + 12 * u], fill=lime)
    d.rectangle([x0 + 15 * u, y0 + 15 * u, x0 + 20 * u, y0 + 20 * u], fill=white)

    # 右侧：日均成本下降折线（越用越便宜）
    pts = [(76 * u, 50 * u), (92 * u, 66 * u), (104 * u, 76 * u), (116 * u, 98 * u)]
    d.line(pts, fill=lime, width=int(round(6 * u)), joint="curve")
    for p in pts:
        r = 5.5 * u
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=white)

    # 底部基线
    d.line([34 * u, 108 * u, 110 * u, 108 * u], fill=white, width=int(round(3.4 * u)))


def write_app_icon(size, name):
    ss = 4
    img = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_app_icon(d, size, ss)
    img = img.resize((size, size), Image.LANCZOS)
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, name)
    img.save(path, "PNG")
    print("wrote", path, img.size)


PAINTERS = [
    ("assets", draw_assets),
    ("wishlist", draw_star),
    ("trends", draw_bars),
    ("settings", draw_settings),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, painter in PAINTERS:
        img, d = canvas()
        painter(d, GREY)
        finish(img, "%s.png" % name)
        img, d = canvas()
        painter(d, ACCENT)
        finish(img, "%s_active.png" % name)

    # 小程序头像：官方要求 144x144 以上、PNG、≤2MB
    write_app_icon(144, "app-icon-144.png")
    write_app_icon(512, "app-icon-512.png")


if __name__ == "__main__":
    main()
