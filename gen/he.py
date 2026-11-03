"""Procedural H&E micrograph of glioblastoma (pseudopalisading necrosis,
glomeruloid microvascular proliferation, fibrillary background).
Stains are composed in optical density space (Beer-Lambert), with the
Ruifrok-Johnston stain vectors, so colours mix like real dyes."""
import sys, math
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 2400, int(sys.argv[2]) if len(sys.argv) > 2 else 1400
OUT = sys.argv[3] if len(sys.argv) > 3 else "he.jpg"
rng = np.random.default_rng(11)

def fractal(shape, sigmas, weights):
    out = np.zeros(shape, np.float32)
    for s, w in zip(sigmas, weights):
        n = rng.standard_normal(shape).astype(np.float32)
        n = ndi.gaussian_filter(n, s)
        n /= n.std() + 1e-6
        out += w * n
    return out

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
CX, CY = W * 0.66, H * 0.5
R = min(W, H) * 0.24                     # necrosis radius
th = np.arctan2(yy - CY, xx - CX)
dist = np.hypot(xx - CX, yy - CY)
edge = 1 + 0.18 * np.sin(3 * th + 0.7) + 0.1 * np.sin(5 * th + 2.1) + 0.05 * np.sin(11 * th)
low = fractal((H, W), [60], [1])
rn = dist / (R * edge) + 0.10 * low + 0.05 * fractal((H, W), [14], [1])   # 1.0 = necrosis border

Hm = np.zeros((H, W), np.float32)        # hematoxylin concentration
Em = np.zeros((H, W), np.float32)        # eosin concentration
Rb = np.zeros((H, W), np.float32)        # red blood cells

# ---- fibrillary neuropil background --------------------------------------
noise = rng.standard_normal((H, W)).astype(np.float32)
fib = np.zeros_like(noise)
for ang in (15, 70, 125, 160):
    n = ndi.rotate(noise, ang, reshape=False, mode="wrap")
    n = ndi.gaussian_filter(n, (0.6, 4.5))
    n = ndi.rotate(n, -ang, reshape=False, mode="wrap")
    fib += np.maximum(n, 0)
fib /= fib.max()
Em += 0.30 + 0.28 * fib + 0.05 * fractal((H, W), [3, 18], [0.5, 1])
Em += 0.06 * low

# microcysts / loose stroma in the outer tumour
cmask = np.zeros((H, W), np.float32)
for _ in range(int(140 * W / 2400)):
    x, y = rng.uniform(0, W), rng.uniform(0, H)
    r0 = rng.uniform(4, 16) * W / 2400
    if rn[int(y), int(x)] < 1.5: continue
    s = int(r0 * 1.6) + 2
    x0, y0, x1, y1 = max(int(x) - s, 0), max(int(y) - s, 0), min(int(x) + s, W), min(int(y) + s, H)
    py, px = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(px - x, py - y) / r0
    cmask[y0:y1, x0:x1] = np.maximum(cmask[y0:y1, x0:x1], np.clip((1 - d) / 0.25, 0, 1))
Em *= 1 - 0.85 * cmask

# ---- necrosis: smudgy eosinophilic debris + nuclear dust -----------------
nec = np.clip((1.0 - rn) / 0.08, 0, 1)
Em = Em * (1 - nec) + nec * np.clip(0.34 + 0.10 * fractal((H, W), [1.2, 6, 30], [0.5, 0.6, 1]), 0.12, 0.8)
Hm += nec * 0.06
clump = ndi.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 40)
clump = (clump - clump.min()) / (clump.max() - clump.min())
dust = (rng.random((H, W)) < 0.0035 * (0.3 + 1.7 * clump)) & (rn < 0.98)
Hm += ndi.gaussian_filter(dust.astype(np.float32), 1.1) * 7.0 * nec
dust2 = (rng.random((H, W)) < 0.0007) & (rn < 0.95)
Hm += ndi.gaussian_filter(dust2.astype(np.float32), 2.0) * 16.0 * nec

# ---- nuclei ----------------------------------------------------------------
chrom = fractal((H, W), [0.8, 2.0], [1, 0.6])

def nucleus(x, y, a, b, rot, dens, halo=0.12, nucleolus=False):
    s = int(max(a, b) * 2.0) + 3
    x0, y0 = int(x) - s, int(y) - s
    x1, y1 = int(x) + s + 1, int(y) + s + 1
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return
    cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    py, px = np.mgrid[cy0:cy1, cx0:cx1].astype(np.float32)
    dx, dy = px - x, py - y
    c, s_ = math.cos(rot), math.sin(rot)
    u, v = dx * c + dy * s_, -dx * s_ + dy * c
    ang = np.arctan2(v, u)
    ph = rng.random(2) * 6.28
    r = np.sqrt((u / a) ** 2 + (v / b) ** 2) * (1 + 0.1 * np.sin(3 * ang + ph[0]) + 0.06 * np.sin(5 * ang + ph[1]))
    m = np.clip((1.05 - r) / 0.18, 0, 1)
    ring = np.exp(-((r - 0.92) / 0.09) ** 2)
    tex = np.clip(0.85 + 0.22 * chrom[cy0:cy1, cx0:cx1], 0.55, 1.25)
    Hm[cy0:cy1, cx0:cx1] += dens * (m * tex + 0.15 * ring * (r < 1.05))
    Em[cy0:cy1, cx0:cx1] += halo * np.clip((1.9 - r) / 0.6, 0, 1) * (1 - m)
    if nucleolus:
        nx, ny = x + rng.normal(0, a * 0.2), y + rng.normal(0, b * 0.2)
        d = np.hypot(px - nx, py - ny)
        Hm[cy0:cy1, cx0:cx1] += 1.2 * np.exp(-(d / 1.3) ** 2)

scale = W / 2400
def jitter_points(step, prob):
    pts = []
    for gy in np.arange(0, H, step):
        for gx in np.arange(0, W, step):
            x, y = gx + rng.uniform(0, step), gy + rng.uniform(0, step)
            if rng.random() < prob(x, y):
                pts.append((x, y))
    return pts

def rn_at(x, y):
    return rn[min(int(y), H - 1), min(int(x), W - 1)]

def density(x, y):
    r = rn_at(x, y)
    if r < 1.0: return 0.0
    if r < 1.16: return 0.97                       # pseudopalisade
    if r < 2.2: return 0.62 - 0.12 * (r - 1.16)    # cellular tumour
    return max(0.12, 0.5 * math.exp(-(r - 2.2) * 1.2))  # infiltration zone

for (x, y) in jitter_points(13 * scale, density):
    r = rn_at(x, y)
    radial = math.atan2(y - CY, x - CX)
    if r < 1.16:   # elongated, radially aligned
        a = rng.uniform(6.5, 9.5) * scale; b = a * rng.uniform(0.38, 0.55)
        nucleus(x, y, a, b, radial + rng.normal(0, 0.25), rng.uniform(1.1, 1.5), halo=0.05)
    else:
        a = rng.uniform(4.8, 8.0) * scale; b = a * rng.uniform(0.6, 0.95)
        dens = rng.uniform(0.75, 1.2)
        nucleolus = rng.random() < 0.15
        if rng.random() < 0.05:                     # pleomorphic giant cells
            a *= 1.8; b *= 1.7; dens = 1.6; nucleolus = True
        nucleus(x, y, a, b, rng.uniform(0, math.pi), dens, halo=rng.uniform(0.08, 0.28), nucleolus=nucleolus)

# ghost cells in the necrosis
for (x, y) in jitter_points(26 * scale, lambda x, y: 0.35 if rn_at(x, y) < 0.9 else 0):
    a = rng.uniform(4.5, 7) * scale
    nucleus(x, y, a, a * rng.uniform(0.6, 0.9), rng.uniform(0, 3.1), rng.uniform(0.12, 0.3), halo=0.04)

# ---- glomeruloid microvascular proliferation -----------------------------
def rbc(x, y):
    rr = rng.uniform(3.0, 3.8) * scale
    s = int(rr * 2) + 2
    x0, y0 = max(int(x) - s, 0), max(int(y) - s, 0)
    x1, y1 = min(int(x) + s + 1, W), min(int(y) + s + 1, H)
    if x1 <= x0 or y1 <= y0: return
    py, px = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    d = np.hypot(px - x, py - y) / rr
    disc = np.clip((1.05 - d) / 0.2, 0, 1) * (0.8 + 0.2 * d)   # biconcave: paler centre
    Rb[y0:y1, x0:x1] = np.maximum(Rb[y0:y1, x0:x1], disc)

def tuft(x, y, size):
    n = rng.integers(4, 9)
    for _ in range(n):
        lx, ly = x + rng.normal(0, size * 0.45), y + rng.normal(0, size * 0.45)
        lr = rng.uniform(5, 12) * scale
        s = int(lr * 3) + 4
        x0, y0 = max(int(lx) - s, 0), max(int(ly) - s, 0)
        x1, y1 = min(int(lx) + s + 1, W), min(int(ly) + s + 1, H)
        if x1 <= x0 or y1 <= y0: continue
        py, px = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.hypot(px - lx, py - ly) / lr
        lumen = np.clip((1.0 - d) / 0.15, 0, 1)
        wall = np.exp(-((d - 1.35) / 0.35) ** 2)
        Em[y0:y1, x0:x1] = Em[y0:y1, x0:x1] * (1 - lumen) + lumen * 0.14 + 0.6 * wall
        Hm[y0:y1, x0:x1] *= (1 - lumen)
        for _ in range(int(lr * 0.35 / scale) + 1):
            a2 = rng.uniform(0, 6.28); rr = rng.uniform(0, 0.6) * lr
            rbc(lx + math.cos(a2) * rr, ly + math.sin(a2) * rr)
        for k in range(rng.integers(5, 10)):                 # plump endothelial cells
            a2 = rng.uniform(0, 6.28); rr = lr * rng.uniform(1.15, 1.6)
            nucleus(lx + math.cos(a2) * rr, ly + math.sin(a2) * rr, rng.uniform(5.5, 8) * scale,
                    rng.uniform(2.6, 3.6) * scale, a2 + math.pi / 2, 1.35, halo=0.15)

for k in range(9):
    a = k / 9 * 6.28 + rng.uniform(-0.25, 0.25)
    rr = rng.uniform(1.45, 2.3)
    x = CX + math.cos(a) * R * rr * 1.05; y = CY + math.sin(a) * R * rr * 0.95
    tuft(x, y, rng.uniform(26, 42) * scale)

# a long capillary running across the infiltration zone
def capillary(p0, p1, bend):
    t = np.linspace(0, 1, 400)
    mx, my = (p0[0] + p1[0]) / 2 + bend[0], (p0[1] + p1[1]) / 2 + bend[1]
    px = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * mx + t ** 2 * p1[0]
    py = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * my + t ** 2 * p1[1]
    mask = np.zeros((H, W), np.float32)
    for x, y in zip(px, py):
        if 0 <= x < W and 0 <= y < H: mask[int(y), int(x)] = 1
    d = ndi.distance_transform_edt(1 - mask)
    lw = 9 * scale
    lumen = np.clip((lw - d) / 1.5, 0, 1)
    wall = np.exp(-((d - lw - 2.5 * scale) / (2.2 * scale)) ** 2)
    global Em, Hm
    Em = Em * (1 - lumen) + lumen * 0.16 + 0.55 * wall; Hm = Hm * (1 - lumen * 0.9)
    for i in range(0, 400, 2):
        for _ in range(2):
            if rng.random() < 0.9: rbc(px[i] + rng.normal(0, lw * 0.3), py[i] + rng.normal(0, lw * 0.3))
    for i in range(5, 395, 11):
        dx, dy = px[i + 1] - px[i - 1], py[i + 1] - py[i - 1]
        ang = math.atan2(dy, dx); side = 1 if rng.random() < 0.5 else -1
        nucleus(px[i] - math.sin(ang) * side * (lw + 3 * scale), py[i] + math.cos(ang) * side * (lw + 3 * scale),
                8.5 * scale, 2.6 * scale, ang, 1.25, halo=0.08)

capillary((W * 1.01, H * 0.42), (W * 0.83, H * 1.03), (W * 0.02, H * 0.05))
capillary((W * 0.30, H * 0.98), (W * 0.52, H * 0.80), (0, H * 0.06))

# ---- optics -----------------------------------------------------------------
vH = np.array([0.65, 0.70, 0.29]); vH /= np.linalg.norm(vH)
vE = np.array([0.07, 0.99, 0.26]); vE /= np.linalg.norm(vE)
vR = np.array([0.10, 0.95, 0.75]); vR /= np.linalg.norm(vR)
uneven = 1 + 0.06 * fractal((H, W), [120], [1])
Hc = ndi.gaussian_filter(Hm, 0.6) * 0.95 + 0.035
Ec = ndi.gaussian_filter(Em, 0.8) * 0.5 * uneven
Rc = ndi.gaussian_filter(Rb, 0.6) * 1.35
OD = Hc[..., None] * vH + Ec[..., None] * vE + Rc[..., None] * vR
img = 255 * np.exp(-OD * 1.25)
img = img * np.array([0.995, 0.985, 1.0])            # slightly cool white balance
img += rng.normal(0, 1.4, img.shape)
img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img).save(OUT, quality=84, optimize=True, progressive=True)
print("saved", OUT, img.shape)
