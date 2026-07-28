"""Extrae el ultimo QR de pairing del bridge.log (arte half-block de qrterminal)
y lo convierte a SVG escaneable. Uso: python qr_to_svg.py <log> <out.svg>"""
import re
import sys

QR_CHARS = set("█▀▄ ")  # █ ▀ ▄ espacio


def main(log_path, out_path):
    with open(log_path, encoding="utf-8", errors="replace") as f:
        lines = [ln.rstrip("\r\n") for ln in f]

    # Lineas de arte QR: solo chars de bloque/espacio, largo minimo
    art_flags = [len(ln) >= 20 and set(ln) <= QR_CHARS and len(set(ln) - {" "}) > 0 for ln in lines]

    # Grupos contiguos; tomar el ultimo
    groups, cur = [], []
    for ln, is_art in zip(lines, art_flags):
        if is_art:
            cur.append(ln)
        elif cur:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    groups = [g for g in groups if len(g) >= 10]
    if not groups:
        print("NO_QR")
        return 1
    art = groups[-1]

    # qrterminal half-block: el glifo dibuja los modulos BLANCOS (fondo terminal oscuro).
    # Autodeteccion con la quiet zone (esquina sup-izq SIEMPRE es blanca):
    # si el primer char es '█', mapping directo; si es ' ', invertido.
    inverted = art[0][0] == " "

    def modules(ch):
        # devuelve (top_es_blanco, bottom_es_blanco) segun el glifo
        if ch == "█":
            t, b = True, True
        elif ch == "▀":
            t, b = True, False
        elif ch == "▄":
            t, b = False, True
        else:
            t, b = False, False
        if inverted:
            t, b = not t, not b
        return t, b

    width = max(len(ln) for ln in art)
    rows = []
    for ln in art:
        ln = ln.ljust(width)
        top, bot = [], []
        for ch in ln:
            t, b = modules(ch)
            top.append(t)
            bot.append(b)
        rows.append(top)
        rows.append(bot)

    scale, margin = 12, 4 * 12
    w = width * scale + 2 * margin
    h = len(rows) * scale + 2 * margin
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}">',
        f'<rect width="{w}" height="{h}" fill="#ffffff"/>',
    ]
    for y, row in enumerate(rows):
        for x, is_white in enumerate(row):
            if not is_white:  # modulo negro del QR
                parts.append(
                    f'<rect x="{margin + x * scale}" y="{margin + y * scale}" '
                    f'width="{scale}" height="{scale}" fill="#000000"/>'
                )
    parts.append("</svg>")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("".join(parts))
    print(f"OK modulos={width}x{len(rows)} inverted={inverted}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
